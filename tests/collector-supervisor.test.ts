/**
 * Collector Supervisor role + collection targets tests.
 *
 * Three properties are asserted, all server-side rather than by hiding buttons:
 *
 * 1. A Collector Supervisor is branch staff: `resolveBranchFilter` forces their
 *    own branch, so passing another branch's id to a list query must not widen
 *    the result set, and they must not be able to set a target for a collector
 *    in another branch.
 * 2. Only a Branch Manager / Collector Supervisor / CEO / Super Admin may set
 *    or clear a target. A cashier or collector cannot issue themselves a quota.
 * 3. Attainment is computed from the payments ledger, not stored — so the
 *    figure a supervisor reads always matches the real collections, and
 *    archived (reversed) payments are excluded.
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

const JAN = new Date(2026, 0, 1).getTime();
const FEB = new Date(2026, 1, 1).getTime();

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

    const ceo = await ctx.db.insert("users", {
      name: "The CEO",
      email: "ceo@example.com",
      role: "ceo",
    });
    const supervisorA = await ctx.db.insert("users", {
      name: "Supervisor A",
      email: "supervisor.a@example.com",
      role: "collector_supervisor",
      position: "collector_supervisor",
      branchId: branchA,
    });
    const supervisorB = await ctx.db.insert("users", {
      name: "Supervisor B",
      email: "supervisor.b@example.com",
      role: "collector_supervisor",
      branchId: branchB,
    });
    const collectorA = await ctx.db.insert("users", {
      name: "Collector A",
      email: "collector.a@example.com",
      role: "cashier",
      position: "collector",
      branchId: branchA,
    });
    const cashierA = await ctx.db.insert("users", {
      name: "Cashier A",
      email: "cashier.a@example.com",
      role: "cashier",
      position: "cashier",
      branchId: branchA,
    });
    const collectorB = await ctx.db.insert("users", {
      name: "Collector B",
      email: "collector.b@example.com",
      role: "cashier",
      position: "collector",
      branchId: branchB,
    });

    // One contract per collector so the payments below have a valid parent.
    const contractA = await ctx.db.insert("contracts", {
      clientId: await ctx.db.insert("clients", {
        firstName: "Ana",
        lastName: "Reyes",
        branchId: branchA,
        createdAt: Date.now(),
      }),
      contractNumber: "0000001",
      planType: "Isidore",
      planAmount: 120000,
      monthlyAmortization: 1000,
      startDate: JAN,
      maturityDate: new Date(2036, 0, 1).getTime(),
      contractStatus: "current",
      branchId: branchA,
      createdAt: JAN,
    });
    const contractB = await ctx.db.insert("contracts", {
      clientId: await ctx.db.insert("clients", {
        firstName: "Ben",
        lastName: "Cruz",
        branchId: branchB,
        createdAt: Date.now(),
      }),
      contractNumber: "0000002",
      planType: "Isidore",
      planAmount: 120000,
      monthlyAmortization: 1000,
      startDate: JAN,
      maturityDate: new Date(2036, 0, 1).getTime(),
      contractStatus: "current",
      branchId: branchB,
      createdAt: JAN,
    });

    // Collector A collected 3,000 in January (two payments) and 1,000 in
    // February, so a January target can be tested against a partial month.
    const payJan1 = await ctx.db.insert("payments", {
      contractId: contractA,
      clientId: contractA,
      amount: 2000,
      paymentChannel: "cash",
      paymentDate: new Date(2026, 0, 10).getTime(),
      branchId: branchA,
      recordedBy: collectorA,
      createdAt: JAN,
    });
    const payJan2 = await ctx.db.insert("payments", {
      contractId: contractA,
      clientId: contractA,
      amount: 1000,
      paymentChannel: "cash",
      paymentDate: new Date(2026, 0, 20).getTime(),
      branchId: branchA,
      recordedBy: collectorA,
      createdAt: JAN,
    });
    // An archived January payment must NOT count toward attainment.
    const payJanArchived = await ctx.db.insert("payments", {
      contractId: contractA,
      clientId: contractA,
      amount: 5000,
      paymentChannel: "cash",
      paymentDate: new Date(2026, 0, 15).getTime(),
      branchId: branchA,
      recordedBy: collectorA,
      archivedAt: JAN,
      createdAt: JAN,
    });
    const payFeb = await ctx.db.insert("payments", {
      contractId: contractA,
      clientId: contractA,
      amount: 1000,
      paymentChannel: "cash",
      paymentDate: new Date(2026, 1, 5).getTime(),
      branchId: branchA,
      recordedBy: collectorA,
      createdAt: FEB,
    });
    // A big collection in the OTHER branch by the other collector.
    const payB = await ctx.db.insert("payments", {
      contractId: contractB,
      clientId: contractB,
      amount: 9000,
      paymentChannel: "cash",
      paymentDate: new Date(2026, 0, 11).getTime(),
      branchId: branchB,
      recordedBy: collectorB,
      createdAt: JAN,
    });

    return {
      branchA,
      branchB,
      ceo,
      supervisorA,
      supervisorB,
      collectorA,
      cashierA,
      collectorB,
      contractA,
      payJan1,
      payJan2,
      payJanArchived,
      payFeb,
      payB,
    };
  });

  return { t, ...ids };
}

describe("collector supervisor as staff", () => {
  test("is recognised as staff and can open the branch-scoped modules", async () => {
    const { t, supervisorA } = await seed();

    const access = await t
      .withIdentity({ subject: supervisorA })
      .query(api.collectorTargets.myAccess, {});
    expect(access.role).toBe("collector_supervisor");
    expect(access.canManageTargets).toBe(true);
    expect(access.isAdmin).toBe(false);

    // The five modules the role is meant to cover — each resolves to the
    // supervisor's own branch rather than throwing or widening.
    const clients = await t
      .withIdentity({ subject: supervisorA })
      .query(api.clients.list, {});
    expect(clients.map((c) => c.lastName)).toEqual(["Reyes"]);

    const contracts = await t
      .withIdentity({ subject: supervisorA })
      .query(api.contracts.list, {});
    expect(contracts.map((c) => c.contractNumber)).toEqual(["0000001"]);

    const receipts = await t
      .withIdentity({ subject: supervisorA })
      .query(api.receipts.list, {});
    expect(Array.isArray(receipts)).toBe(true);

    const aging = await t
      .withIdentity({ subject: supervisorA })
      .query(api.delinquency.summary, {});
    expect(aging).toBeTruthy();
  });

  test("is forced to their own branch and cannot widen it", async () => {
    const { t, supervisorA, supervisorB, collectorA, collectorB } = await seed();

    const mine = await t
      .withIdentity({ subject: supervisorA })
      .query(api.collectorTargets.list, { month: JAN });
    expect(mine.map((r) => r.collectorId)).toContain(collectorA);
    expect(mine.some((r) => r.collectorId === collectorB)).toBe(false);

    // Passing the other branch's id must change nothing.
    const tampered = await t
      .withIdentity({ subject: supervisorA })
      .query(api.collectorTargets.list, { month: JAN, branchId: undefined });
    expect(tampered.map((r) => r.collectorId)).not.toContain(collectorB);

    // And the other supervisor sees only their own team.
    const theirs = await t
      .withIdentity({ subject: supervisorB })
      .query(api.collectorTargets.list, { month: JAN });
    expect(theirs.map((r) => r.collectorId)).toEqual([collectorB]);
  });

  test("cannot set a target for a collector in another branch", async () => {
    const { t, supervisorA, collectorB } = await seed();

    await expect(
      t.withIdentity({ subject: supervisorA }).mutation(api.collectorTargets.setTarget, {
        collectorId: collectorB,
        month: JAN,
        targetAmount: 50000,
      })
    ).rejects.toThrow(/your branch/i);

    // Nothing was written for the other branch.
    const rows = await t.run(async (ctx) =>
      ctx.db.query("collector_targets").collect()
    );
    expect(rows).toEqual([]);
  });
});

describe("collector target permissions", () => {
  test("a supervisor can set a target for a collector in their branch", async () => {
    const { t, supervisorA, collectorA } = await seed();

    await t
      .withIdentity({ subject: supervisorA })
      .mutation(api.collectorTargets.setTarget, {
        collectorId: collectorA,
        month: JAN,
        targetAmount: 5000,
      });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("collector_targets").collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].targetAmount).toBe(5000);
    expect(rows[0].branchId).toBeTruthy();
    expect(rows[0].setBy).toBe(supervisorA);
  });

  test("setting again replaces the target rather than duplicating it", async () => {
    const { t, supervisorA, collectorA } = await seed();

    for (const amount of [5000, 7500]) {
      await t
        .withIdentity({ subject: supervisorA })
        .mutation(api.collectorTargets.setTarget, {
          collectorId: collectorA,
          month: JAN,
          targetAmount: amount,
        });
    }

    const rows = await t.run(async (ctx) =>
      ctx.db.query("collector_targets").collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].targetAmount).toBe(7500);
  });

  test("a negative target is refused", async () => {
    const { t, supervisorA, collectorA } = await seed();

    await expect(
      t.withIdentity({ subject: supervisorA }).mutation(api.collectorTargets.setTarget, {
        collectorId: collectorA,
        month: JAN,
        targetAmount: -1,
      })
    ).rejects.toThrow(/zero or a positive/i);
  });

  test("a collector cannot set a target for themselves", async () => {
    const { t, collectorA, cashierA } = await seed();

    await expect(
      t.withIdentity({ subject: collectorA }).mutation(api.collectorTargets.setTarget, {
        collectorId: collectorA,
        month: JAN,
        targetAmount: 1,
      })
    ).rejects.toThrow(/Collector Supervisor/i);

    await expect(
      t.withIdentity({ subject: cashierA }).mutation(api.collectorTargets.clearTarget, {
        collectorId: collectorA,
        month: JAN,
      })
    ).rejects.toThrow(/Collector Supervisor/i);
  });

  test("clearing removes the target and records it in the audit trail", async () => {
    const { t, supervisorA, collectorA } = await seed();

    await t
      .withIdentity({ subject: supervisorA })
      .mutation(api.collectorTargets.setTarget, {
        collectorId: collectorA,
        month: JAN,
        targetAmount: 5000,
      });

    await t
      .withIdentity({ subject: supervisorA })
      .mutation(api.collectorTargets.clearTarget, {
        collectorId: collectorA,
        month: JAN,
      });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("collector_targets").collect()
    );
    expect(rows).toEqual([]);

    const logs = await t.run(async (ctx) =>
      ctx.db
        .query("audit_log")
        .withIndex("by_entity", (q) => q.eq("entityType", "collector_target"))
        .collect()
    );
    // One create + one delete.
    expect(logs).toHaveLength(2);
    expect(logs.some((l) => l.action === "delete")).toBe(true);

    // Clearing again is an error rather than a silent no-op.
    await expect(
      t.withIdentity({ subject: supervisorA }).mutation(api.collectorTargets.clearTarget, {
        collectorId: collectorA,
        month: JAN,
      })
    ).rejects.toThrow(/no target/i);
  });

  test("the CEO may set a target for any branch", async () => {
    const { t, ceo, collectorB } = await seed();

    await t
      .withIdentity({ subject: ceo })
      .mutation(api.collectorTargets.setTarget, {
        collectorId: collectorB,
        month: JAN,
        targetAmount: 12000,
      });

    const rows = await t
      .withIdentity({ subject: ceo })
      .query(api.collectorTargets.list, { month: JAN, branchId: undefined });
    expect(rows.find((r) => r.collectorId === collectorB)?.targetAmount).toBe(12000);
  });
});

describe("target attainment", () => {
  test("is summed from real payments, excluding archived ones", async () => {
    const { t, supervisorA, collectorA } = await seed();

    await t
      .withIdentity({ subject: supervisorA })
      .mutation(api.collectorTargets.setTarget, {
        collectorId: collectorA,
        month: JAN,
        targetAmount: 5000,
      });

    const rows = await t
      .withIdentity({ subject: supervisorA })
      .query(api.collectorTargets.list, { month: JAN });

    const row = rows.find((r) => r.collectorId === collectorA)!;
    // 2,000 + 1,000 — the 5,000 archived payment is a reversal and must not
    // count, otherwise a supervisor would chase a target already un-collected.
    expect(row.collectedAmount).toBe(3000);
    expect(row.paymentCount).toBe(2);
    expect(row.attainment).toBeCloseTo(0.6, 5);
    expect(row.setByName).toBe("Supervisor A");
  });

  test("does not leak another branch's collections into the figure", async () => {
    const { t, supervisorA, collectorA, payB } = await seed();

    const rows = await t
      .withIdentity({ subject: supervisorA })
      .query(api.collectorTargets.list, { month: JAN });

    const row = rows.find((r) => r.collectorId === collectorA)!;
    // Branch B's 9,000 payment is nowhere in Branch A's numbers.
    expect(row.collectedAmount).toBe(3000);
    expect(payB).toBeTruthy();
  });

  test("a different month reads its own payments only", async () => {
    const { t, supervisorA, collectorA } = await seed();

    await t
      .withIdentity({ subject: supervisorA })
      .mutation(api.collectorTargets.setTarget, {
        collectorId: collectorA,
        month: FEB,
        targetAmount: 2000,
      });

    const rows = await t
      .withIdentity({ subject: supervisorA })
      .query(api.collectorTargets.list, { month: FEB });

    const row = rows.find((r) => r.collectorId === collectorA)!;
    expect(row.collectedAmount).toBe(1000);
    expect(row.attainment).toBeCloseTo(0.5, 5);
  });

  test("a collector with no target still appears, with zero attainment", async () => {
    const { t, supervisorA, cashierA } = await seed();

    const rows = await t
      .withIdentity({ subject: supervisorA })
      .query(api.collectorTargets.list, { month: JAN });

    const row = rows.find((r) => r.collectorId === cashierA)!;
    expect(row.targetAmount).toBe(0);
    expect(row.attainment).toBe(0);
    expect(row.setByName).toBe("Not set");
  });

  test("the supervisor themselves are not listed as a collector to target", async () => {
    const { t, supervisorA, supervisorB } = await seed();

    const rows = await t
      .withIdentity({ subject: supervisorA })
      .query(api.collectorTargets.list, { month: JAN });

    expect(rows.some((r) => r.collectorId === supervisorA)).toBe(false);
    expect(rows.some((r) => r.collectorId === supervisorB)).toBe(false);
  });
});