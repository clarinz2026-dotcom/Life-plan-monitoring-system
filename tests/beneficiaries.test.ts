/**
 * Beneficiary editing tests.
 *
 * The Statement of Account has four beneficiary slots, backed by the
 * `clients.beneficiaries` list, and falls back to the legacy
 * single-beneficiary fields whenever that list is empty. These tests pin the
 * behaviour staff depend on when they edit the list from a planholder's page —
 * including the case that motivated the field mirroring: clearing the list must
 * not let a removed beneficiary reappear through the fallback.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";

// `_generated` must stay in the map — convex-test locates the project root from
// it. `airtable.ts` is excluded because it is a "use node" module and cannot be
// loaded in the edge runtime these tests run in.
const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "!../src/convex/**/*.test.ts",
  "!../src/convex/airtable.ts",
]);

/** Two branches, one manager each, and one planholder each. */
async function seed() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const branchA = await ctx.db.insert("branches", {
      name: "Branch 001",
      code: "EVF-001",
      address: "1 A Street",
      city: "Malaybalay City",
      province: "Bukidnon",
      isActive: true,
      createdAt: Date.now(),
    });
    const branchB = await ctx.db.insert("branches", {
      name: "Branch 002",
      code: "EVF-002",
      address: "2 B Street",
      city: "Valencia City",
      province: "Bukidnon",
      isActive: true,
      createdAt: Date.now(),
    });

    const managerA = await ctx.db.insert("users", {
      name: "Manager A",
      email: "manager.a@example.com",
      role: "manager",
      position: "branch_manager",
      branchId: branchA,
    });
    const managerB = await ctx.db.insert("users", {
      name: "Manager B",
      email: "manager.b@example.com",
      role: "manager",
      position: "branch_manager",
      branchId: branchB,
    });

    const clientIn = (branchId: typeof branchA, createdBy: typeof managerA, n: string) =>
      ctx.db.insert("clients", {
        firstName: `Planholder${n}`,
        lastName: "Sample",
        dateOfBirth: Date.now(),
        gender: "other",
        contactNumber: `0917000000${n}`,
        address: `${n} Street`,
        city: "Malaybalay City",
        province: "Bukidnon",
        zipCode: "8700",
        // Imported records carry these placeholders when nothing was captured.
        beneficiaryName: "TBD",
        beneficiaryRelationship: "TBD",
        branchId,
        createdAt: Date.now(),
        createdBy,
      });

    const clientA = await clientIn(branchA, managerA, "1");
    const clientB = await clientIn(branchB, managerB, "2");

    return { branchA, branchB, managerA, managerB, clientA, clientB };
  });

  return { t, ...ids };
}

const FOUR = [
  { name: "Maria Santos", age: 42, relationship: "Spouse" },
  { name: "Jose Santos", age: 17, relationship: "Son" },
  { name: "Liza Santos", age: 14, relationship: "Daughter" },
  { name: "Pedro Santos", age: 71, relationship: "Father" },
];

describe("Editing beneficiaries", () => {
  test("staff can record four beneficiaries", async () => {
    const { t, managerA, clientA } = await seed();
    const asManager = t.withIdentity({ subject: managerA });

    await asManager.mutation(api.clients.update, {
      clientId: clientA,
      beneficiaries: FOUR,
    });

    const client = await asManager.query(api.clients.get, { clientId: clientA });
    expect(client?.beneficiaries).toEqual(FOUR);
  });

  test("age is optional per beneficiary", async () => {
    const { t, managerA, clientA } = await seed();
    const asManager = t.withIdentity({ subject: managerA });

    await asManager.mutation(api.clients.update, {
      clientId: clientA,
      beneficiaries: [{ name: "Ana Cruz", relationship: "Mother" }],
    });

    const client = await asManager.query(api.clients.get, { clientId: clientA });
    expect(client?.beneficiaries).toEqual([
      { name: "Ana Cruz", relationship: "Mother" },
    ]);
  });

  test("the legacy fields follow the first beneficiary", async () => {
    const { t, managerA, clientA } = await seed();
    const asManager = t.withIdentity({ subject: managerA });

    await asManager.mutation(api.clients.update, {
      clientId: clientA,
      beneficiaries: FOUR,
    });

    const client = await asManager.query(api.clients.get, { clientId: clientA });
    // The statement prints the list, but anything still reading the legacy
    // fields must not contradict it.
    expect(client?.beneficiaryName).toBe("Maria Santos");
    expect(client?.beneficiaryRelationship).toBe("Spouse");
  });

  test("clearing the list clears the legacy fields too", async () => {
    const { t, managerA, clientA } = await seed();
    const asManager = t.withIdentity({ subject: managerA });

    await asManager.mutation(api.clients.update, {
      clientId: clientA,
      beneficiaries: FOUR,
    });
    await asManager.mutation(api.clients.update, {
      clientId: clientA,
      beneficiaries: [],
    });

    const client = await asManager.query(api.clients.get, { clientId: clientA });
    expect(client?.beneficiaries).toEqual([]);
    // Otherwise a beneficiary the office just deleted would reappear on the
    // statement through the single-beneficiary fallback.
    expect(client?.beneficiaryName).toBe("");
    expect(client?.beneficiaryRelationship).toBe("");
  });

  test("editing other fields leaves the beneficiaries alone", async () => {
    const { t, managerA, clientA } = await seed();
    const asManager = t.withIdentity({ subject: managerA });

    await asManager.mutation(api.clients.update, {
      clientId: clientA,
      beneficiaries: FOUR,
    });
    await asManager.mutation(api.clients.update, {
      clientId: clientA,
      address: "99 New Street",
    });

    const client = await asManager.query(api.clients.get, { clientId: clientA });
    expect(client?.address).toBe("99 New Street");
    expect(client?.beneficiaries).toEqual(FOUR);
  });

  test("a manager cannot edit another branch's planholder", async () => {
    const { t, managerA, clientB } = await seed();

    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.clients.update, {
        clientId: clientB,
        beneficiaries: FOUR,
      })
    ).rejects.toThrow();
  });

  test("an unauthenticated caller cannot edit beneficiaries", async () => {
    const { t, clientA } = await seed();

    await expect(
      t.mutation(api.clients.update, { clientId: clientA, beneficiaries: FOUR })
    ).rejects.toThrow();
  });
});
