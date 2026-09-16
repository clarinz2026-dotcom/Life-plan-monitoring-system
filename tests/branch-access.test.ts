/**
 * Branch authorization tests.
 *
 * These prove the security property the whole multi-branch model rests on:
 * the branch a request is served for is decided by the *authenticated account
 * on the server*, never by anything the browser sends. Each test below is an
 * attempt that a malicious or careless client could actually make — tampering
 * with `branchId`, pasting another branch's record id into a URL, or calling a
 * Convex query with no session at all.
 *
 * `convex-test` runs the real Convex functions against an in-memory database,
 * so these exercise the same guards the deployed app uses
 * (`convex/access.ts`), not a reimplementation of them.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";
import {
  manilaDayStart,
  manilaDaysInMonth,
  manilaMonthStart,
  manilaMonthStartOffset,
} from "../src/convex/datetime";

// `_generated` must stay in the map — convex-test locates the project root from
// it. `airtable.ts` is excluded because it is a "use node" module and cannot be
// loaded in the edge runtime these tests run in.
const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "!../src/convex/**/*.test.ts",
  "!../src/convex/airtable.ts",
]);

const BRANCH_A_CODE = "EVF-001";
const BRANCH_B_CODE = "EVF-002";

/**
 * Two branches, a CEO with no branch (Head Office), one manager per branch, and
 * one planholder + contract + payment in each branch.
 */
async function seed() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const branchA = await ctx.db.insert("branches", {
      name: "Branch 001",
      code: BRANCH_A_CODE,
      address: "1 A Street",
      city: "Malaybalay City",
      province: "Bukidnon",
      isActive: true,
      createdAt: Date.now(),
    });
    const branchB = await ctx.db.insert("branches", {
      name: "Branch 002",
      code: BRANCH_B_CODE,
      address: "2 B Street",
      city: "Valencia City",
      province: "Bukidnon",
      isActive: true,
      createdAt: Date.now(),
    });

    const ceo = await ctx.db.insert("users", {
      name: "Head Office",
      email: "ceo@example.com",
      role: "ceo",
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
    const unassigned = await ctx.db.insert("users", {
      name: "New Hire",
      email: "new.hire@example.com",
    });

    const clientA = await ctx.db.insert("clients", {
      firstName: "Alpha",
      lastName: "Planholder",
      dateOfBirth: Date.now(),
      gender: "other",
      contactNumber: "09170000001",
      address: "1 A Street",
      city: "Malaybalay City",
      province: "Bukidnon",
      zipCode: "8700",
      beneficiaryName: "TBD",
      beneficiaryRelationship: "TBD",
      branchId: branchA,
      createdAt: Date.now(),
      createdBy: managerA,
    });
    const clientB = await ctx.db.insert("clients", {
      firstName: "Bravo",
      lastName: "Planholder",
      dateOfBirth: Date.now(),
      gender: "other",
      contactNumber: "09170000002",
      address: "2 B Street",
      city: "Valencia City",
      province: "Bukidnon",
      zipCode: "8709",
      beneficiaryName: "TBD",
      beneficiaryRelationship: "TBD",
      branchId: branchB,
      createdAt: Date.now(),
      createdBy: managerB,
    });

    const contractA = await ctx.db.insert("contracts", {
      clientId: clientA,
      contractNumber: "LPA-A-001",
      planType: "St. Gabriel",
      planAmount: 39000,
      monthlyAmortization: 650,
      totalPaid: 650,
      contractStatus: "current",
      startDate: Date.now(),
      branchId: branchA,
      createdAt: Date.now(),
      createdBy: managerA,
    });
    const contractB = await ctx.db.insert("contracts", {
      clientId: clientB,
      contractNumber: "LPA-B-001",
      planType: "St. Gabriel",
      planAmount: 39000,
      monthlyAmortization: 650,
      totalPaid: 650,
      contractStatus: "current",
      startDate: Date.now(),
      branchId: branchB,
      createdAt: Date.now(),
      createdBy: managerB,
    });

    await ctx.db.insert("payments", {
      contractId: contractA,
      clientId: clientA,
      amount: 650,
      paymentChannel: "cash",
      paymentDate: Date.now(),
      orNumber: "OR-A-1",
      branchId: branchA,
      recordedBy: managerA,
      createdAt: Date.now(),
    });
    await ctx.db.insert("payments", {
      contractId: contractB,
      clientId: clientB,
      amount: 650,
      paymentChannel: "cash",
      paymentDate: Date.now(),
      orNumber: "OR-B-1",
      branchId: branchB,
      recordedBy: managerB,
      createdAt: Date.now(),
    });

    // Audit entries, one per branch, to prove the trail is scoped too.
    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "client",
      entityId: clientA,
      userId: managerA,
      userName: "Manager A",
      description: "Created Branch 001 planholder",
      branchId: branchA,
      timestamp: Date.now(),
    });
    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "client",
      entityId: clientB,
      userId: managerB,
      userName: "Manager B",
      description: "Created Branch 002 planholder",
      branchId: branchB,
      timestamp: Date.now(),
    });

    return {
      branchA,
      branchB,
      ceo,
      managerA,
      managerB,
      unassigned,
      clientA,
      clientB,
      contractA,
      contractB,
    };
  });

  return { t, ...ids };
}

describe("Head Office — global access", () => {
  test("reads every branch, and can narrow to one", async () => {
    const { t, ceo, clientA, clientB, branchA } = await seed();
    const asCeo = t.withIdentity({ subject: ceo });

    const all = await asCeo.query(api.clients.list, {});
    expect(all.map((c) => c._id).sort()).toEqual([clientA, clientB].sort());

    // Choosing a branch in the `[ ALL BRANCHES ▼ ]` selector scopes the data.
    const scoped = await asCeo.query(api.clients.list, { branchId: branchA });
    expect(scoped.map((c) => c._id)).toEqual([clientA]);
  });

  test("sees both branches' performance side by side", async () => {
    const { t, ceo } = await seed();
    const rows = await t.withIdentity({ subject: ceo }).query(
      api.branches.summary,
      {}
    );
    expect(rows.map((r) => r.code).sort()).toEqual([
      BRANCH_A_CODE,
      BRANCH_B_CODE,
    ]);
    for (const row of rows) {
      expect(row.clientCount).toBe(1);
      expect(row.monthAmount).toBe(650);
    }
  });

  test("can read a specific planholder in any branch", async () => {
    const { t, ceo, clientB } = await seed();
    const client = await t
      .withIdentity({ subject: ceo })
      .query(api.clients.get, { clientId: clientB });
    expect(client?.firstName).toBe("Bravo");
  });
});

describe("Branch Manager — isolated to their own branch", () => {
  test("a list with no filter returns only their branch", async () => {
    const { t, managerA, clientA } = await seed();
    const clients = await t
      .withIdentity({ subject: managerA })
      .query(api.clients.list, {});
    expect(clients.map((c) => c._id)).toEqual([clientA]);
  });

  test("tampering with branchId in the request changes nothing", async () => {
    const { t, managerA, branchB, clientA } = await seed();
    const asManagerA = t.withIdentity({ subject: managerA });

    // The obvious attack: ask for the other branch explicitly.
    const clients = await asManagerA.query(api.clients.list, {
      branchId: branchB,
    });
    expect(clients.map((c) => c._id)).toEqual([clientA]);

    // Same on the dashboard, which aggregates money.
    const summary = await asManagerA.query(api.dashboard.summary, {
      branchId: branchB,
    });
    expect(summary.totalClients).toBe(1);
    expect(summary.totalPaymentAmount).toBe(650);
  });

  test("pasting another branch's record id into the URL is rejected", async () => {
    const { t, managerA, clientB, contractB } = await seed();
    const asManagerA = t.withIdentity({ subject: managerA });

    await expect(
      asManagerA.query(api.clients.get, { clientId: clientB })
    ).rejects.toThrow(/another branch/i);

    await expect(
      asManagerA.query(api.contracts.get, { contractId: contractB })
    ).rejects.toThrow(/another branch/i);
  });

  test("payment ledgers only contain their own branch", async () => {
    const { t, managerA, branchB } = await seed();
    const payments = await t
      .withIdentity({ subject: managerA })
      .query(api.payments.list, { branchId: branchB });
    expect(payments).toHaveLength(1);
    expect(payments[0].orNumber).toBe("OR-A-1");
  });

  test("the branch roster and performance table expose one branch only", async () => {
    const { t, managerA, branchA, branchB } = await seed();
    const asManagerA = t.withIdentity({ subject: managerA });

    const branches = await asManagerA.query(api.branches.list, {});
    expect(branches.map((b) => b.code)).toEqual([BRANCH_A_CODE]);

    const rows = await asManagerA.query(api.branches.summary, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(branchA);

    // Reading the other branch directly is refused.
    await expect(
      asManagerA.query(api.branches.get, { branchId: branchB })
    ).rejects.toThrow(/outside your access/i);
  });

  test("the audit trail is branch-scoped", async () => {
    const { t, managerA } = await seed();
    const logs = await t
      .withIdentity({ subject: managerA })
      .query(api.audit.list, { limit: 50 });
    expect(logs).toHaveLength(1);
    expect(logs[0].description).toContain("Branch 001");
  });

  test("cannot write to another branch's records", async () => {
    const { t, managerA, clientB, branchB } = await seed();
    const asManagerA = t.withIdentity({ subject: managerA });

    await expect(
      asManagerA.mutation(api.clients.update, {
        clientId: clientB,
        firstName: "Hijacked",
      })
    ).rejects.toThrow(/your assigned branch/i);

    await expect(
      asManagerA.mutation(api.clients.archive, { clientIds: [clientB] })
    ).rejects.toThrow(/your assigned branch/i);

    await expect(
      asManagerA.mutation(api.branches.update, {
        branchId: branchB,
        name: "Renamed by intruder",
      })
    ).rejects.toThrow(/Super Admin or CEO/i);
  });
});

describe("Staff management is scoped", () => {
  test("a manager can staff their own branch", async () => {
    const { t, managerA, unassigned, branchA } = await seed();
    await t.withIdentity({ subject: managerA }).mutation(api.users.assignBranch, {
      userId: unassigned,
      branchId: branchA,
      position: "collector",
    });

    const team = await t
      .withIdentity({ subject: managerA })
      .query(api.users.branchTeam, {});
    expect(team.map((m) => m.email)).toContain("new.hire@example.com");
    // The position also grants the matching access role.
    expect(team.find((m) => m.email === "new.hire@example.com")?.role).toBe(
      "finance_staff"
    );
  });

  test("a manager cannot move anyone into another branch", async () => {
    const { t, managerA, unassigned, branchB } = await seed();
    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.users.assignBranch, {
        userId: unassigned,
        branchId: branchB,
        position: "collector",
      })
    ).rejects.toThrow(/own branch/i);
  });

  test("a manager cannot pull staff out of another branch or touch admins", async () => {
    const { t, managerA, managerB, ceo, branchA } = await seed();
    const asManagerA = t.withIdentity({ subject: managerA });

    await expect(
      asManagerA.mutation(api.users.assignBranch, {
        userId: managerB,
        branchId: branchA,
        position: "cashier",
      })
    ).rejects.toThrow(/another branch/i);

    await expect(
      asManagerA.mutation(api.users.assignBranch, {
        userId: ceo,
        branchId: branchA,
        position: "collector",
      })
    ).rejects.toThrow(/CEO or Super Admin/i);
  });

  test("a manager cannot change their own branch", async () => {
    const { t, managerA, branchB } = await seed();
    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.users.assignBranch, {
        userId: managerA,
        branchId: branchB,
        position: "branch_manager",
      })
    ).rejects.toThrow(/your own branch assignment|another branch|own branch/i);
  });

  test("only Head Office can assign roles", async () => {
    const { t, managerA, unassigned } = await seed();
    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.users.setRole, {
        userId: unassigned,
        role: "manager",
      })
    ).rejects.toThrow(/Super Admin or CEO/i);
  });
});

describe("Anonymous callers", () => {
  test("cannot read clients, payments, or reports", async () => {
    const { t } = await seed();
    await expect(t.query(api.clients.list, {})).rejects.toThrow(
      /Not authenticated/i
    );
    await expect(t.query(api.payments.list, {})).rejects.toThrow(
      /Not authenticated/i
    );
    await expect(t.query(api.reports.collectionSummary, {})).rejects.toThrow(
      /Not authenticated/i
    );
    await expect(t.query(api.dashboard.summary, {})).rejects.toThrow(
      /Not authenticated/i
    );
    await expect(t.query(api.branches.list, {})).rejects.toThrow(
      /Not authenticated/i
    );
  });

  test("the client portal still has a branch directory it may read", async () => {
    const { t } = await seed();
    const branches = await t.query(api.branches.publicList, {});
    expect(branches.map((b) => b.code).sort()).toEqual([
      BRANCH_A_CODE,
      BRANCH_B_CODE,
    ]);
    // …but it exposes no staffing or performance data.
    expect(Object.keys(branches[0])).not.toContain("managerName");
    expect(Object.keys(branches[0])).not.toContain("staffCount");
  });
});

describe("Historical data is preserved", () => {
  test("archiving hides a planholder without deleting history", async () => {
    const { t, ceo, managerA, clientA, clientB } = await seed();
    const asCeo = t.withIdentity({ subject: ceo });

    expect(await asCeo.query(api.clients.list, {})).toHaveLength(2);

    await asCeo.mutation(api.clients.archive, {
      clientIds: [clientA],
      reason: "duplicate",
    });

    // Hidden from the working list, but still there when asked for.
    const visible = await asCeo.query(api.clients.list, {});
    expect(visible.map((c) => c._id)).toEqual([clientB]);
    const withArchived = await asCeo.query(api.clients.list, {
      includeArchived: true,
    });
    expect(withArchived.map((c) => c._id).sort()).toEqual(
      [clientA, clientB].sort()
    );

    // Payments, contracts, and the audit trail are untouched.
    expect(await asCeo.query(api.payments.list, {})).toHaveLength(2);

    // The owning branch can restore it.
    await t
      .withIdentity({ subject: managerA })
      .mutation(api.clients.restore, { clientIds: [clientA] });
    expect(await asCeo.query(api.clients.list, {})).toHaveLength(2);
  });

  test("permanent deletion is refused once a payment exists", async () => {
    const { t, ceo, clientA } = await seed();
    await expect(
      t
        .withIdentity({ subject: ceo })
        .mutation(api.clients.bulkDelete, { clientIds: [clientA] })
    ).rejects.toThrow(/archive this planholder instead/i);
  });

  test("a manager cannot permanently delete at all", async () => {
    const { t, managerA, clientA } = await seed();
    await expect(
      t
        .withIdentity({ subject: managerA })
        .mutation(api.clients.bulkDelete, { clientIds: [clientA] })
    ).rejects.toThrow(/Super Admin or CEO/i);
  });

  test("deleting a planholder with no payments is still allowed for Head Office", async () => {
    const { t, ceo, clientB } = await seed();
    // Remove the branch 002 payment so the record has no financial history.
    await t.run(async (ctx) => {
      const payments = await ctx.db.query("payments").collect();
      for (const p of payments) {
        if (p.orNumber === "OR-B-1") await ctx.db.delete(p._id);
      }
    });
    const result = await t
      .withIdentity({ subject: ceo })
      .mutation(api.clients.bulkDelete, { clientIds: [clientB] });
    expect(result.deleted).toBe(1);
  });
});

describe("Branch transfers", () => {
  test("move the planholder, keep collections with the recording branch", async () => {
    const { t, ceo, clientA, clientB, branchA, branchB, managerB } =
      await seed();
    const asCeo = t.withIdentity({ subject: ceo });

    const result = await asCeo.mutation(api.branches.transferClient, {
      clientId: clientA,
      toBranchId: branchB,
      reason: "planholder relocated",
    });
    expect(result.movedContracts).toBe(1);
    expect(result.retainedPayments).toBe(1);

    // The contract and client now belong to branch 002…
    const client = await asCeo.query(api.clients.get, { clientId: clientA });
    expect(client?.branchId).toBe(branchB);

    // …while the collection stays under branch 001, so no branch's historical
    // totals or reconciliation change because of a move.
    const payments = await asCeo.query(api.payments.list, {});
    const moved = payments.find((p) => p.orNumber === "OR-A-1");
    expect(moved?.branchId).toBe(branchA);

    // Branch 002 can now open the planholder it received, alongside its own.
    const asManagerB = t.withIdentity({ subject: managerB });
    const visible = await asManagerB.query(api.clients.list, {});
    expect(visible.map((c) => c._id).sort()).toEqual(
      [clientA, clientB].sort()
    );

    // The move is recorded permanently.
    const history = await asCeo.query(api.branches.transferHistory, {
      clientId: clientA,
    });
    expect(history).toHaveLength(1);
    expect(history[0].toBranchId).toBe(branchB);
  });

  test("only Head Office may transfer", async () => {
    const { t, managerA, clientA, branchB } = await seed();
    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.branches.transferClient, {
        clientId: clientA,
        toBranchId: branchB,
      })
    ).rejects.toThrow(/Super Admin or CEO/i);
  });
});

describe("Asia/Manila time boundaries", () => {
  // The deployment clock is UTC, so a report read at 7am Manila used to be a
  // day behind and early-morning collections landed in the previous day/month.
  test("a Manila day starts at 16:00 UTC the previous day", () => {
    const noonManila = Date.UTC(2026, 8, 16, 4, 0); // 12:00 Manila, 16 Sep
    expect(manilaDayStart(noonManila)).toBe(Date.UTC(2026, 8, 15, 16, 0));
  });

  test("an early-morning Manila collection belongs to that Manila day", () => {
    const earlyManila = Date.UTC(2026, 8, 15, 23, 30); // 07:30 Manila, 16 Sep
    const manilaDay = manilaDayStart(earlyManila);
    expect(manilaDay).toBe(Date.UTC(2026, 8, 15, 16, 0));
    expect(earlyManila).toBeGreaterThanOrEqual(manilaDay);
    expect(earlyManila).toBeLessThan(manilaDay + 24 * 60 * 60 * 1000);
  });

  test("the Manila month rolls over at 16:00 UTC on the last day", () => {
    const startOfSeptember = Date.UTC(2026, 8, 1, 1, 0); // 09:00 Manila, 1 Sep
    expect(manilaMonthStart(startOfSeptember)).toBe(
      Date.UTC(2026, 7, 31, 16, 0)
    );

    const endOfAugust = Date.UTC(2026, 7, 31, 15, 59); // 23:59 Manila, 31 Aug
    expect(manilaMonthStart(endOfAugust)).toBe(Date.UTC(2026, 6, 31, 16, 0));
  });

  test("month arithmetic is stable for reports", () => {
    const january = Date.UTC(2026, 0, 15, 4, 0);
    // Start of the previous Manila month = 1 Dec 2025 Manila.
    expect(manilaMonthStartOffset(-1, january)).toBe(
      Date.UTC(2025, 10, 30, 16, 0)
    );
    expect(manilaDaysInMonth(Date.UTC(2026, 1, 3, 4, 0))).toBe(28);
    // Leap year, to be sure the day count is not hard-coded.
    expect(manilaDaysInMonth(Date.UTC(2028, 1, 3, 4, 0))).toBe(29);
  });
});
