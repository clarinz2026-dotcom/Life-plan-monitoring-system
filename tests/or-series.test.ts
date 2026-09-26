/**
 * OR series assignation tests.
 *
 * Two properties matter here, and both are enforced server-side rather than by
 * hiding buttons in the UI:
 *
 * 1. A collector or branch manager may only ever read the series in their own
 *    hands. `orSeries.list` takes an optional `branchId`, and submitting another
 *    branch's id must not widen the result set.
 * 2. Only Finance Staff, the CEO and the Super Admin may hand out or take back
 *    a series — a collector cannot issue themselves a receipt book, however the
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
 * collector per branch, plus a series already in each collector's hands.
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
    const collectorA = await ctx.db.insert("users", {
      name: "Collector A",
      email: "collector.a@example.com",
      role: "cashier",
      position: "collector",
      branchId: branchA,
    });
    const collectorB = await ctx.db.insert("users", {
      name: "Collector B",
      email: "collector.b@example.com",
      role: "cashier",
      position: "collector",
      branchId: branchB,
    });

    const seriesA = await ctx.db.insert("or_series", {
      seriesCode: "2026-A",
      startNumber: 1,
      endNumber: 250,
      assignedTo: collectorA,
      branchId: branchA,
      status: "active",
      assignedBy: finance,
      assignedAt: Date.now(),
    });
    const seriesB = await ctx.db.insert("or_series", {
      seriesCode: "2026-B",
      startNumber: 251,
      endNumber: 500,
      assignedTo: collectorB,
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
      collectorA,
      collectorB,
      seriesA,
      seriesB,
    };
  });

  return { t, ...ids };
}

describe("OR series visibility", () => {
  test("a collector sees only the series in their own hands", async () => {
    const { t, collectorA, collectorB, seriesA, seriesB } = await seed();

    const rows = await t.withIdentity({ subject: collectorA }).query(api.orSeries.list, {});

    expect(rows.map((r) => r._id)).toEqual([seriesA]);
    expect(rows[0].assignedToName).toBe("Collector A");
    // The block size is derived, not stored, so the ledger can never disagree.
    expect(rows[0].count).toBe(250);
    expect(rows.some((r) => r._id === seriesB)).toBe(false);
    expect(rows.some((r) => r.assignedToName === "Collector B")).toBe(false);
  });

  test("a branch manager sees only the series assigned to them", async () => {
    const { t, managerA, seriesA, seriesB } = await seed();

    // Nothing has been issued to Manager A yet, so their ledger is empty even
    // though two series exist in the company.
    const rows = await t.withIdentity({ subject: managerA }).query(api.orSeries.list, {});
    expect(rows).toEqual([]);

    // Once Finance issues one to them, exactly that row appears.
    await t.run(async (ctx) => {
      const { managerA: m } = { managerA };
      await ctx.db.insert("or_series", {
        seriesCode: "2026-C",
        startNumber: 501,
        endNumber: 600,
        assignedTo: m,
        status: "active",
        assignedBy: managerA,
        assignedAt: Date.now(),
      });
    });

    const after = await t.withIdentity({ subject: managerA }).query(api.orSeries.list, {});
    expect(after.map((r) => r.seriesCode)).toEqual(["2026-C"]);
    expect(after.some((r) => r._id === seriesA || r._id === seriesB)).toBe(false);
  });

  test("a collector cannot widen their ledger by asking for another branch", async () => {
    const { t, collectorA, branchB, seriesB } = await seed();

    // Passing the other branch's id — the same tampering shape the rest of the
    // app's branch model defends against — must change nothing.
    const rows = await t
      .withIdentity({ subject: collectorA })
      .query(api.orSeries.list, { branchId: branchB });

    expect(rows.some((r) => r._id === seriesB)).toBe(false);
    expect(rows).toHaveLength(1);
  });

  test("finance staff sees every series in the company, with its branch", async () => {
    const { t, finance, seriesA, seriesB, branchA, branchB } = await seed();

    const rows = await t.withIdentity({ subject: finance }).query(api.orSeries.list, {});

    expect(rows.map((r) => r._id).sort()).toEqual([seriesA, seriesB].sort());
    const byCode = Object.fromEntries(rows.map((r) => [r.seriesCode, r]));
    expect(byCode["2026-A"].branchId).toBe(branchA);
    expect(byCode["2026-A"].branchName).toBe("Branch 001");
    expect(byCode["2026-B"].branchId).toBe(branchB);
    expect(byCode["2026-B"].branchName).toBe("Branch 002");
  });

  test("finance staff can narrow the company ledger to one branch", async () => {
    const { t, finance, branchA, seriesB } = await seed();

    const rows = await t
      .withIdentity({ subject: finance })
      .query(api.orSeries.list, { branchId: branchA });

    expect(rows).toHaveLength(1);
    expect(rows[0].seriesCode).toBe("2026-A");
    expect(rows.some((r) => r._id === seriesB)).toBe(false);
  });

  test("an anonymous caller cannot read the ledger at all", async () => {
    const { t } = await seed();
    await expect(t.query(api.orSeries.list, {})).rejects.toThrow();
  });
});

describe("OR series assignment", () => {
  test("finance staff can assign a series and it lands on the ledger", async () => {
    const { t, finance, collectorA, branchA } = await seed();

    const result = await t
      .withIdentity({ subject: finance })
      .mutation(api.orSeries.assign, {
        seriesCode: "2027-a",
        startNumber: 1001,
        endNumber: 1250,
        assignedTo: collectorA,
      });

    const row = await t.run(async (ctx) => ctx.db.get(result.seriesId));
    // Stored uppercase, and anchored to the holder's own branch by default.
    expect(row?.seriesCode).toBe("2027-A");
    expect(row?.branchId).toBe(branchA);
    expect(row?.status).toBe("active");
    expect(row?.assignedBy).toBe(finance);

    const visible = await t
      .withIdentity({ subject: collectorA })
      .query(api.orSeries.list, {});
    expect(visible.some((r) => r._id === result.seriesId)).toBe(true);
  });

  test("a collector cannot assign a series to anyone, including themselves", async () => {
    const { t, collectorA, collectorB } = await seed();

    await expect(
      t.withIdentity({ subject: collectorA }).mutation(api.orSeries.assign, {
        seriesCode: "SELF-1",
        startNumber: 1,
        endNumber: 100,
        assignedTo: collectorA,
      })
    ).rejects.toThrow(/Finance Staff/i);

    await expect(
      t.withIdentity({ subject: collectorA }).mutation(api.orSeries.assign, {
        seriesCode: "GIFT-1",
        startNumber: 1,
        endNumber: 100,
        assignedTo: collectorB,
      })
    ).rejects.toThrow(/Finance Staff/i);
  });

  test("a branch manager cannot assign or revoke a series", async () => {
    const { t, managerA, collectorA, seriesA } = await seed();

    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.orSeries.assign, {
        seriesCode: "MGR-1",
        startNumber: 1,
        endNumber: 100,
        assignedTo: collectorA,
      })
    ).rejects.toThrow(/Finance Staff/i);

    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.orSeries.revoke, {
        seriesId: seriesA,
      })
    ).rejects.toThrow(/Finance Staff/i);
  });

  test("a duplicate series code is refused", async () => {
    const { t, finance, collectorA } = await seed();

    await expect(
      t.withIdentity({ subject: finance }).mutation(api.orSeries.assign, {
        seriesCode: "2026-a", // same book, different case
        startNumber: 900,
        endNumber: 1000,
        assignedTo: collectorA,
      })
    ).rejects.toThrow(/already exists/i);
  });

  test("a backwards or empty number range is refused", async () => {
    const { t, finance, collectorA } = await seed();

    await expect(
      t.withIdentity({ subject: finance }).mutation(api.orSeries.assign, {
        seriesCode: "BAD-1",
        startNumber: 500,
        endNumber: 100,
        assignedTo: collectorA,
      })
    ).rejects.toThrow(/end number/i);

    await expect(
      t.withIdentity({ subject: finance }).mutation(api.orSeries.assign, {
        seriesCode: "BAD-2",
        startNumber: 0,
        endNumber: 100,
        assignedTo: collectorA,
      })
    ).rejects.toThrow(/1 or above/i);

    await expect(
      t.withIdentity({ subject: finance }).mutation(api.orSeries.assign, {
        seriesCode: "   ",
        startNumber: 1,
        endNumber: 100,
        assignedTo: collectorA,
      })
    ).rejects.toThrow(/series code/i);
  });

  test("revoking records the return and keeps the row on the ledger", async () => {
    const { t, finance, collectorA, seriesA } = await seed();

    await t.withIdentity({ subject: finance }).mutation(api.orSeries.revoke, {
      seriesId: seriesA,
    });

    const rows = await t.withIdentity({ subject: collectorA }).query(api.orSeries.list, {});
    const row = rows.find((r) => r._id === seriesA);
    expect(row?.status).toBe("revoked");
    expect(row?.returnedAt).toBeTypeOf("number");

    // Revoking twice is a no-op error rather than a second return entry.
    await expect(
      t.withIdentity({ subject: finance }).mutation(api.orSeries.revoke, { seriesId: seriesA })
    ).rejects.toThrow(/already revoked/i);
  });

  test("an assignment is written to the audit trail", async () => {
    const { t, finance, collectorA } = await seed();

    await t
      .withIdentity({ subject: finance })
      .mutation(api.orSeries.assign, {
        seriesCode: "2026-D",
        startNumber: 1,
        endNumber: 250,
        assignedTo: collectorA,
        notes: "BIR ATOR book",
      });

    const logs = await t.run(async (ctx) =>
      ctx.db
        .query("audit_log")
        .withIndex("by_entity", (q) => q.eq("entityType", "or_series"))
        .collect()
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].description).toMatch(/2026-D/);
    expect(logs[0].description).toMatch(/Collector A/);
    expect(logs[0].userId).toBe(finance);
  });

  test("only assigners can read the staff roster for the dialog", async () => {
    const { t, finance, collectorA } = await seed();

    const roster = await t.withIdentity({ subject: finance }).query(api.orSeries.assignableStaff, {});
    const emails = roster.map((u) => u.email);
    expect(emails).toContain("collector.a@example.com");
    // Admin accounts do not collect, so they are never offered as holders.
    expect(emails).not.toContain("finance@example.com");

    await expect(
      t.withIdentity({ subject: collectorA }).query(api.orSeries.assignableStaff, {})
    ).rejects.toThrow(/Finance Staff/i);
  });
});
