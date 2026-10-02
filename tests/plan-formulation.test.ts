/**
 * Plan formulation tests.
 *
 * The office's formulation pairs each plan type with one plan value and one
 * monthly amortization — Isidore ₱30,000 / ₱500, Gabriel ₱39,000 / ₱650,
 * Raphael ₱51,000 / ₱850, Michael ₱57,000 / ₱950 — and staff should never have
 * to retype them.
 *
 * Both halves are pinned here: the name matcher (staff type "St. Isidore",
 * "ISIDORE", anything carrying the plan's name) and the server-side rule in
 * `contracts.create` / `contracts.update` that stores the formulated pair
 * whatever was typed into the form. Plans the office has not formulated keep
 * the numbers entered for them.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";
import {
  formulationFor,
  formulatedValues,
  PLAN_FORMULATIONS,
} from "../src/lib/planFormulation";

// `_generated` must stay in the map — convex-test locates the project root from
// it. `airtable.ts` is excluded because it is a "use node" module and cannot be
// loaded in the edge runtime these tests run in.
const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "!../src/convex/**/*.test.ts",
  "!../src/convex/airtable.ts",
]);

const JAN = new Date(2026, 0, 1).getTime();

describe("the formulation table", () => {
  test("pairs every formulated plan with its value and monthly rate", () => {
    expect(
      PLAN_FORMULATIONS.map((p) => [p.name, p.planAmount, p.monthly])
    ).toEqual([
      ["Isidore", 30_000, 500],
      ["Gabriel", 39_000, 650],
      ["Raphael", 51_000, 850],
      ["Michael", 57_000, 950],
    ]);
  });

  test("each pair is the monthly rate over the 60-month term", () => {
    for (const plan of PLAN_FORMULATIONS) {
      expect(plan.planAmount).toBe(plan.monthly * 60);
    }
  });
});

describe("matching a plan name", () => {
  test("matches case-insensitively and through the office's adornments", () => {
    expect(formulatedValues("Isidore")).toEqual({
      planAmount: 30_000,
      monthlyAmortization: 500,
    });
    expect(formulatedValues("ISIDORE ")).toEqual({
      planAmount: 30_000,
      monthlyAmortization: 500,
    });
    expect(formulatedValues("St. Gabriel")).toEqual({
      planAmount: 39_000,
      monthlyAmortization: 650,
    });
    expect(formulatedValues("raphael plan")).toEqual({
      planAmount: 51_000,
      monthlyAmortization: 850,
    });
    expect(formulationFor("Michael")?.name).toBe("Michael");
  });

  test("leaves unformulated and empty plan names alone", () => {
    expect(formulationFor("Memorial Plan A")).toBeNull();
    expect(formulationFor("Gab")).toBeNull();
    expect(formulationFor("")).toBeNull();
    expect(formulationFor(null)).toBeNull();
    expect(formulationFor(undefined)).toBeNull();
    expect(formulatedValues("Legacy Plan")).toBeNull();
  });
});

/** A CEO (company-wide) with one planholder on a branch. */
async function seed() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const branch = await ctx.db.insert("branches", {
      name: "Branch 001",
      code: "EVF-001",
      address: "1 A Street",
      city: "Malaybalay City",
      province: "Bukidnon",
      isActive: true,
      createdAt: Date.now(),
    });
    const ceo = await ctx.db.insert("users", {
      name: "The CEO",
      email: "ceo@example.com",
      role: "ceo",
    });
    const clientId = await ctx.db.insert("clients", {
      firstName: "Ana",
      lastName: "Reyes",
      branchId: branch,
      createdAt: Date.now(),
    });
    return { branch, ceo, clientId };
  });

  return { t, ...ids };
}

describe("contracts.create applies the formulation", () => {
  test("stores the formulated pair whatever the form was given", async () => {
    const { t, ceo, clientId } = await seed();

    const contractId = await t
      .withIdentity({ subject: ceo })
      .mutation(api.contracts.create, {
        clientId,
        contractNumber: "0000001",
        planType: "Gabriel",
        planAmount: 1,
        monthlyAmortization: 1,
        startDate: JAN,
      });

    const stored = await t.run((ctx) => ctx.db.get(contractId));
    expect(stored?.planType).toBe("Gabriel");
    expect(stored?.planAmount).toBe(39_000);
    expect(stored?.monthlyAmortization).toBe(650);
  });

  test("keeps entered values for a plan the office has not formulated", async () => {
    const { t, ceo, clientId } = await seed();

    const contractId = await t
      .withIdentity({ subject: ceo })
      .mutation(api.contracts.create, {
        clientId,
        contractNumber: "0000002",
        planType: "Memorial Plan A",
        planAmount: 12_000,
        monthlyAmortization: 200,
        startDate: JAN,
      });

    const stored = await t.run((ctx) => ctx.db.get(contractId));
    expect(stored?.planAmount).toBe(12_000);
    expect(stored?.monthlyAmortization).toBe(200);
  });
});

describe("contracts.update applies the formulation", () => {
  test("pulls a retyped plan back onto its formulated pair and audits it", async () => {
    const { t, ceo, clientId } = await seed();

    const contractId = await t
      .withIdentity({ subject: ceo })
      .mutation(api.contracts.create, {
        clientId,
        contractNumber: "0000003",
        planType: "Memorial Plan A",
        planAmount: 12_000,
        monthlyAmortization: 200,
        startDate: JAN,
      });

    await t.withIdentity({ subject: ceo }).mutation(api.contracts.update, {
      contractId,
      contractNumber: "0000003",
      planType: "Michael",
      planAmount: 12_000,
      monthlyAmortization: 200,
      startDate: JAN,
      contractStatus: "current",
    });

    const stored = await t.run((ctx) => ctx.db.get(contractId));
    expect(stored?.planType).toBe("Michael");
    expect(stored?.planAmount).toBe(57_000);
    expect(stored?.monthlyAmortization).toBe(950);

    // The correction is written to the audit trail like any other edit.
    const audit = await t.run((ctx) =>
      ctx.db.query("audit_log").collect()
    );
    const entry = audit.find(
      (a) => a.entityType === "contract" && a.action === "update"
    );
    expect(entry).toBeTruthy();
    expect(entry?.oldValues?.planAmount).toBe(12_000);
    expect(entry?.newValues?.planAmount).toBe(57_000);
  });
});
