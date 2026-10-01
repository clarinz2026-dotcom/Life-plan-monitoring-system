/**
 * LPA control number series assignation tests.
 *
 * The LPA register is the control-number counterpart of the O.R. book register,
 * and it carries the same two guarantees — both enforced server-side, not by
 * hiding buttons in the UI:
 *
 * 1. A branch manager or cashier may only ever read the control-number series
 *    in their own hands. `lpaSeries.list` takes an optional `branchId`, and
 *    submitting another branch's id must not widen the result set.
 * 2. Only Finance Staff, the CEO and the Super Admin may hand out or take back
 *    a series — a cashier cannot issue themselves control numbers, however the
 *    request is made.
 *
 * `convex-test` runs the real Convex functions against an in-memory database,
 * so these exercise the same guards the deployed app uses.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";

const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "!../src/convex/**/*.test.ts",
  "!../src/convex/airtable.ts",
]);

/**
 * Two branches, one Finance officer (company-wide), one branch manager and one
 * cashier per branch, plus a series already in each branch's hands.
 */
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

    const finance = await ctx.db.insert("users", {
      name: "Finance Officer",
      email: "finance@example.com",
      role: "finance_staff",
    });
    const managerA = await ctx.db.insert("users", {
      name: "Manager A",
      email: "manager.a@example.com",
      role: "manager",
      position: "branch_manager",
      branchId: branchA,
    });
    const cashierA = await ctx.db.insert("users", {
      name: "Cashier A",
      email: "cashier.a@example.com",
      role: "cashier",
      position: "cashier",
      branchId: branchA,
    });
    const cashierB = await ctx.db.insert("users", {
      name: "Cashier B",
      email: "cashier.b@example.com",
      role: "cashier",
      position: "cashier",
      branchId: branchB,
    });

    const seriesA = await ctx.db.insert("lpa_series", {
      seriesCode: "2026-LPA-A",
      startNumber: 12345,
      endNumber: 12500,
      assignedTo: cashierA,
      branchId: branchA,
      status: "active",
      assignedBy: finance,
      assignedAt: Date.now(),
    });
    const seriesB = await ctx.db.insert("lpa_series", {
      seriesCode: "2026-LPA-B",
      startNumber: 12501,
      endNumber: 12750,
      assignedTo: cashierB,
      branchId: branchB,
      status: "active",
      assignedBy: finance,
      assignedAt: Date.now(),
    });

    return {
      branchA,
      branchB,
      finance,
      managerA,
      cashierA,
      cashierB,
      seriesA,
      seriesB,
    };
  });

  return { t, ...ids };
}

describe("LPA series visibility", () => {
  test("a cashier sees only the series in their own hands", async () => {
    const { t, cashierA, cashierB, seriesA, seriesB } = await seed();

    const rows = await t.withIdentity({ subject: cashierA }).query(api.lpaSeries.list, {});

    expect(rows.map((r) => r._id)).toEqual([seriesA]);
    expect(rows[0].assignedToName).toBe("Cashier A");
    // The block size is derived, not stored, so the ledger can never disagree.
    expect(rows[0].count).toBe(156);
    expect(rows.some((r) => r._id === seriesB)).toBe(false);
    expect(rows.some((r) => r.assignedToName === "Cashier B")).toBe(false);
  });

  test("a branch manager sees only the series assigned to them", async () => {
    const { t, managerA, seriesA, seriesB } = await seed();

    // Nothing has been issued to Manager A yet, so their ledger is empty even
    // though two series exist in the company.
    const rows = await t.withIdentity({ subject: managerA }).query(api.lpaSeries.list, {});
    expect(rows).toEqual([]);

    // Once Finance issues one to them, exactly that row appears.
    await t.run(async (ctx) => {
      await ctx.db.insert("lpa_series", {
        seriesCode: "2026-LPA-C",
        startNumber: 12751,
        endNumber: 12850,
        assignedTo: managerA,
        status: "active",
        assignedBy: managerA,
        assignedAt: Date.now(),
      });
    });

    const after = await t.withIdentity({ subject: managerA }).query(api.lpaSeries.list, {});
    expect(after.map((r) => r.seriesCode)).toEqual(["2026-LPA-C"]);
    expect(after.some((r) => r._id === seriesA || r._id === seriesB)).toBe(false);
  });

  test("a cashier cannot widen their ledger by asking for another branch", async () => {
    const { t, cashierA, branchB, seriesB } = await seed();

    // Passing the other branch's id — the same tampering shape the rest of the
    // app's branch model defends against — must change nothing.
    const rows = await t
      .withIdentity({ subject: cashierA })
      .query(api.lpaSeries.list, { branchId: branchB });

    expect(rows.some((r) => r._id === seriesB)).toBe(false);
    expect(rows).toHaveLength(1);
  });

  test("finance staff sees every series in the company, with its branch", async () => {
    const { t, finance, seriesA, seriesB, branchA, branchB } = await seed();

    const rows = await t.withIdentity({ subject: finance }).query(api.lpaSeries.list, {});

    expect(rows.map((r) => r._id).sort()).toEqual([seriesA, seriesB].sort());
    const byCode = Object.fromEntries(rows.map((r) => [r.seriesCode, r]));
    expect(byCode["2026-LPA-A"].branchId).toBe(branchA);
    expect(byCode["2026-LPA-A"].branchName).toBe("Branch 001");
    expect(byCode["2026-LPA-B"].branchId).toBe(branchB);
    expect(byCode["2026-LPA-B"].branchName).toBe("Branch 002");
  });

  test("finance staff can narrow the company ledger to one branch", async () => {
    const { t, finance, branchA, seriesB } = await seed();

    const rows = await t
      .withIdentity({ subject: finance })
      .query(api.lpaSeries.list, { branchId: branchA });

    expect(rows).toHaveLength(1);
    expect(rows[0].seriesCode).toBe("2026-LPA-A");
    expect(rows.some((r) => r._id === seriesB)).toBe(false);
  });

  test("an anonymous caller cannot read the ledger at all", async () => {
    const { t } = await seed();
    await expect(t.query(api.lpaSeries.list, {})).rejects.toThrow();
  });
});

describe("LPA series assignment", () => {
  test("finance staff can assign a series and it lands on the ledger", async () => {
    const { t, finance, cashierA, branchA } = await seed();

    const result = await t
      .withIdentity({ subject: finance })
      .mutation(api.lpaSeries.assign, {
        seriesCode: "2027-lpa-a",
        startNumber: 20001,
        endNumber: 20250,
        assignedTo: cashierA,
      });

    const row = await t.run(async (ctx) => ctx.db.get(result.seriesId));
    // Stored uppercase, and anchored to the holder's own branch by default.
    expect(row?.seriesCode).toBe("2027-LPA-A");
    expect(row?.branchId).toBe(branchA);
    expect(row?.status).toBe("active");
    expect(row?.assignedBy).toBe(finance);

    const visible = await t
      .withIdentity({ subject: cashierA })
      .query(api.lpaSeries.list, {});
    expect(visible.some((r) => r._id === result.seriesId)).toBe(true);
  });

  test("a cashier cannot assign a series to anyone, including themselves", async () => {
    const { t, cashierA, cashierB } = await seed();

    await expect(
      t.withIdentity({ subject: cashierA }).mutation(api.lpaSeries.assign, {
        seriesCode: "SELF-1",
        startNumber: 1,
        endNumber: 100,
        assignedTo: cashierA,
      })
    ).rejects.toThrow(/Finance Staff/i);

    await expect(
      t.withIdentity({ subject: cashierA }).mutation(api.lpaSeries.assign, {
        seriesCode: "GIFT-1",
        startNumber: 1,
        endNumber: 100,
        assignedTo: cashierB,
      })
    ).rejects.toThrow(/Finance Staff/i);
  });

  test("a branch manager cannot assign or revoke a series", async () => {
    const { t, managerA, cashierA, seriesA } = await seed();

    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.lpaSeries.assign, {
        seriesCode: "MGR-1",
        startNumber: 1,
        endNumber: 100,
        assignedTo: cashierA,
      })
    ).rejects.toThrow(/Finance Staff/i);

    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.lpaSeries.revoke, {
        seriesId: seriesA,
      })
    ).rejects.toThrow(/Finance Staff/i);
  });

  test("a duplicate series code is refused", async () => {
    const { t, finance, cashierA } = await seed();

    await expect(
      t.withIdentity({ subject: finance }).mutation(api.lpaSeries.assign, {
        seriesCode: "2026-lpa-a", // same block, different case
        startNumber: 30001,
        endNumber: 30100,
        assignedTo: cashierA,
      })
    ).rejects.toThrow(/already exists/i);
  });

  test("a backwards or empty number range is refused", async () => {
    const { t, finance, cashierA } = await seed();

    await expect(
      t.withIdentity({ subject: finance }).mutation(api.lpaSeries.assign, {
        seriesCode: "BAD-1",
        startNumber: 500,
        endNumber: 100,
        assignedTo: cashierA,
      })
    ).rejects.toThrow(/end number/i);

    await expect(
      t.withIdentity({ subject: finance }).mutation(api.lpaSeries.assign, {
        seriesCode: "BAD-2",
        startNumber: 0,
        endNumber: 100,
        assignedTo: cashierA,
      })
    ).rejects.toThrow(/1 or above/i);

    await expect(
      t.withIdentity({ subject: finance }).mutation(api.lpaSeries.assign, {
        seriesCode: "   ",
        startNumber: 1,
        endNumber: 100,
        assignedTo: cashierA,
      })
    ).rejects.toThrow(/series code/i);
  });

  test("revoking records the return and keeps the row on the ledger", async () => {
    const { t, finance, cashierA, seriesA } = await seed();

    await t.withIdentity({ subject: finance }).mutation(api.lpaSeries.revoke, {
      seriesId: seriesA,
    });

    const rows = await t.withIdentity({ subject: cashierA }).query(api.lpaSeries.list, {});
    const row = rows.find((r) => r._id === seriesA);
    expect(row?.status).toBe("revoked");
    expect(row?.returnedAt).toBeTypeOf("number");

    // Revoking twice is a no-op error rather than a second return entry.
    await expect(
      t.withIdentity({ subject: finance }).mutation(api.lpaSeries.revoke, { seriesId: seriesA })
    ).rejects.toThrow(/already revoked/i);
  });

  test("marking a series fully used closes it to further issue", async () => {
    const { t, finance, seriesA } = await seed();

    await t.withIdentity({ subject: finance }).mutation(api.lpaSeries.markConsumed, {
      seriesId: seriesA,
    });

    const row = await t.run(async (ctx) => ctx.db.get(seriesA));
    expect(row?.status).toBe("consumed");

    // A consumed block cannot be consumed or revoked again.
    await expect(
      t.withIdentity({ subject: finance }).mutation(api.lpaSeries.markConsumed, { seriesId: seriesA })
    ).rejects.toThrow(/already consumed/i);
  });

  test("an assignment is written to the audit trail", async () => {
    const { t, finance, cashierA } = await seed();

    await t
      .withIdentity({ subject: finance })
      .mutation(api.lpaSeries.assign, {
        seriesCode: "2026-LPA-D",
        startNumber: 1,
        endNumber: 250,
        assignedTo: cashierA,
        notes: "LPA ATOR book",
      });

    const logs = await t.run(async (ctx) =>
      ctx.db
        .query("audit_log")
        .withIndex("by_entity", (q) => q.eq("entityType", "lpa_series"))
        .collect()
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].description).toMatch(/2026-LPA-D/);
    expect(logs[0].description).toMatch(/Cashier A/);
    expect(logs[0].userId).toBe(finance);
  });

  test("only assigners can read the staff roster for the dialog", async () => {
    const { t, finance, cashierA } = await seed();

    const roster = await t.withIdentity({ subject: finance }).query(api.lpaSeries.assignableStaff, {});
    const emails = roster.map((u) => u.email);
    expect(emails).toContain("cashier.a@example.com");
    // Admin accounts do not hold blocks, so they are never offered as holders.
    expect(emails).not.toContain("finance@example.com");

    await expect(
      t.withIdentity({ subject: cashierA }).query(api.lpaSeries.assignableStaff, {})
    ).rejects.toThrow(/Finance Staff/i);
  });
});