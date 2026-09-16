import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  assertBranchVisible,
  assertCanManageBranch,
  assertStaff,
  isAdminRole,
} from "./access";
import { manilaMonthStart } from "./datetime";

/**
 * Create a branch.
 */
export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    address: v.string(),
    city: v.string(),
    province: v.string(),
    contactNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    operatingHours: v.optional(v.string()),
    receiptPrefix: v.optional(v.string()),
    openingDate: v.optional(v.number()),
    managerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!isAdminRole(user?.role ?? null)) {
      throw new Error("Only the Super Admin or CEO can create branches.");
    }

    // Branch codes identify a branch everywhere (receipts, reports, exports),
    // so they are normalised and must stay unique.
    const code = args.code.trim().toUpperCase();
    if (!code) throw new Error("A branch code is required.");
    const clash = await findBranchByCode(ctx, code);
    if (clash) {
      throw new Error(
        `Branch code ${code} is already used by "${clash.name}". Pick another code.`
      );
    }

    const branchId = await ctx.db.insert("branches", {
      ...args,
      code,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "client", // reused as the generic system-event entity type
      entityId: branchId,
      userId,
      userName: user?.name ?? user?.email ?? "Unknown",
      description: `Branch created: ${args.name} (${code}) in ${args.city}, ${args.province}`,
      newValues: { name: args.name, code, city: args.city, province: args.province },
      branchId,
      timestamp: Date.now(),
    });

    return { branchId };
  },
});

/**
 * Branch settings update (Head Office: any branch; Branch Manager: their own).
 *
 * The fields a branch controls for itself are profile/operational data —
 * address, contact details, hours, receipt prefix. Anything that changes the
 * *shape* of the system (creating branches, moving people between branches,
 * plans, security) stays with Head Office.
 */
export const updateSettings = mutation({
  args: {
    branchId: v.id("branches"),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    province: v.optional(v.string()),
    contactNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    operatingHours: v.optional(v.string()),
    receiptPrefix: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertCanManageBranch(ctx, args.branchId);
    const { branchId, ...updates } = args;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Record<string, unknown>;
    if (Object.keys(clean).length === 0) return { success: true };

    const before = await ctx.db.get(branchId);
    if (!before) throw new Error("Branch not found.");
    await ctx.db.patch(branchId, { ...clean, updatedAt: Date.now() });

    const actor = await ctx.db.get(viewer.userId);

    await ctx.db.insert("audit_log", {
      action: "update",
      entityType: "client", // reused as the generic system-event entity type
      entityId: branchId,
      userId: viewer.userId,
      userName: actor?.name || actor?.email || "Unknown",
      description: `Branch settings updated for ${before.name} (${before.code})`,
      oldValues: {
        address: before.address,
        contactNumber: before.contactNumber ?? null,
        email: before.email ?? null,
        operatingHours: before.operatingHours ?? null,
        receiptPrefix: before.receiptPrefix ?? null,
      },
      newValues: clean,
      branchId,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Public branch directory for the client portal.
 *
 * The portal runs as a planholder account, which is not staff, so it can never
 * call the staff-only `branches.list`. This exposes the minimum a planholder
 * legitimately needs — active branches and where they are — and nothing about
 * staff, managers, or branch performance.
 */
export const publicList = query({
  args: {},
  handler: async (ctx) => {
    const branches = await ctx.db.query("branches").collect();
    return branches
      .filter((b) => b.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((b) => ({
        _id: b._id,
        name: b.name,
        code: b.code,
        address: b.address,
        city: b.city,
        province: b.province,
        contactNumber: b.contactNumber ?? null,
        email: b.email ?? null,
        operatingHours: b.operatingHours ?? null,
      }));
  },
});

/**
 * Main office branch (authoritative address).
 *
 * 2nd Floor, Gabrinez Bldg
 * Fortich St.
 * Malaybalay City, Bukidnon 8700
 * Philippines
 */
export const MAIN_OFFICE = {
  name: "Evangelist Funeral Services — Main Office",
  code: "MBS-001",
  address: "2nd Floor, Gabrinez Building",
  city: "Malaybalay City",
  province: "Bukidnon",
  contactNumber: "(02) 8-700-0000",
  managerId: null,
} as const;

/**
 * List all branches (staff only).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    // Staff only (this used to be readable by any signed-in account, including
    // planholder portal logins). Branch staff only ever see their own branch;
    // Head Office sees the full roster.
    const viewer = await assertStaff(ctx);

    let branches = await ctx.db.query("branches").collect();
    if (!isAdminRole(viewer.role)) {
      branches = branches.filter((b) => b._id === viewer.branchId);
    }

    // Resolve manager names with one read per distinct manager instead of one
    // db.get per branch.
    const managerIds = Array.from(
      new Set(branches.map((b) => b.managerId).filter(Boolean))
    ) as Array<NonNullable<(typeof branches)[number]["managerId"]>>;
    const managers = await Promise.all(managerIds.map((id) => ctx.db.get(id)));
    const managerNameById = new Map(
      managerIds.map((id, i) => [id, managers[i]?.name || managers[i]?.email || null])
    );

    return branches.map((b) => ({
      ...b,
      managerName: (b.managerId && managerNameById.get(b.managerId)) || null,
    }));
  },
});

/**
 * Update a branch.
 */
export const update = mutation({
  args: {
    branchId: v.id("branches"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    province: v.optional(v.string()),
    contactNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    operatingHours: v.optional(v.string()),
    receiptPrefix: v.optional(v.string()),
    openingDate: v.optional(v.number()),
    managerId: v.optional(v.id("users")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!isAdminRole(user?.role ?? null)) {
      throw new Error("Only the Super Admin or CEO can update branches.");
    }

    const { branchId, ...updates } = args;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    if (typeof clean.code === "string") {
      const code = clean.code.trim().toUpperCase();
      if (!code) throw new Error("A branch code is required.");
      const clash = await findBranchByCode(ctx, code);
      if (clash && clash._id !== branchId) {
        throw new Error(
          `Branch code ${code} is already used by "${clash.name}". Pick another code.`
        );
      }
      clean.code = code;
    }

    if (Object.keys(clean).length === 0) return;

    const before = await ctx.db.get(branchId);
    await ctx.db.patch(branchId, { ...clean, updatedAt: Date.now() });

    await ctx.db.insert("audit_log", {
      action: "update",
      entityType: "client",
      entityId: branchId,
      userId,
      userName: user?.name ?? user?.email ?? "Unknown",
      description: `Branch updated: ${before?.name ?? branchId}`,
      oldValues: before ? { name: before.name, code: before.code, isActive: before.isActive } : undefined,
      newValues: clean,
      branchId,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get a single branch (staff only).
 */
export const get = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    // Admins may read any branch; branch staff only their own.
    await assertBranchVisible(ctx, args.branchId);
    return await ctx.db.get(args.branchId);
  },
});

/**
 * Branch performance summary — one row per branch with key stats.
 * Used by CEO to compare branches side by side.
 */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await assertStaff(ctx);

    // Head Office compares every branch side by side. Branch staff receive
    // exactly one row — their own — so the same query powers the Branch
    // Manager's "My Branch" panel without exposing another branch's figures.
    let branches = await ctx.db.query("branches").collect();
    if (!isAdminRole(viewer.role)) {
      branches = branches.filter((b) => b._id === viewer.branchId);
    }
    // Manila month boundary — the server clock is UTC, which would otherwise
    // push collections made before 8am on the 1st into the previous month.
    const monthStart = manilaMonthStart();

    // Read the staff list once instead of once per branch.
    const allUsers = await ctx.db.query("users").collect();

    const results = await Promise.all(
      branches.map(async (b) => {
        // Clients in this branch
        const clients = await ctx.db
          .query("clients")
          .withIndex("by_branch", (q) => q.eq("branchId", b._id))
          .collect();

        // Contracts in this branch
        const contracts = await ctx.db
          .query("contracts")
          .withIndex("by_branch", (q) => q.eq("branchId", b._id))
          .collect();

        let totalContractValue = 0;
        let totalCollected = 0;
        let fullyPaidCount = 0;
        const contractsByStatus: Record<string, number> = {};
        for (const c of contracts) {
          contractsByStatus[c.contractStatus] = (contractsByStatus[c.contractStatus] || 0) + 1;
          totalContractValue += c.planAmount;
          totalCollected += c.totalPaid;
          if (c.contractStatus === "fully_paid") fullyPaidCount++;
        }

        // Payments this month
        const payments = await ctx.db
          .query("payments")
          .withIndex("by_branch", (q) => q.eq("branchId", b._id))
          .collect();
        const monthPayments = payments.filter((p) => p.paymentDate >= monthStart);
        const monthAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);

        // Staff count
        const staffCount = allUsers.filter((u) => u.branchId === b._id).length;

        const manager = b.managerId ? await ctx.db.get(b.managerId) : null;

        return {
          _id: b._id,
          name: b.name,
          code: b.code,
          address: b.address,
          city: b.city,
          province: b.province,
          contactNumber: b.contactNumber,
          email: b.email ?? null,
          operatingHours: b.operatingHours ?? null,
          receiptPrefix: b.receiptPrefix ?? null,
          openingDate: b.openingDate ?? b.createdAt,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt ?? b.createdAt,
          isActive: b.isActive,
          managerName: manager?.name || manager?.email || null,
          clientCount: clients.length,
          contractCount: contracts.length,
          fullyPaidCount,
          totalContractValue,
          totalCollected,
          collectionRate: totalContractValue > 0
            ? Math.min(Math.round((totalCollected / totalContractValue) * 100), 100)
            : 0,
          monthPayments: monthPayments.length,
          monthAmount,
          totalPaymentAmount,
          staffCount,
          contractsByStatus,
        };
      })
    );

    return results;
  },
});

/**
 * Delete a branch (CEO/Super Admin only). Only if no clients/contracts reference it.
 */
export const remove = mutation({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "super_admin" && user?.role !== "ceo") {
      throw new Error("Only Super Admin or CEO can delete branches.");
    }

    // A branch that carries history is never hard-deleted — deactivate it
    // instead so payments, receipts and reports keep their branch context.
    const held = await branchHistoryCounts(ctx, args.branchId);
    if (held.total > 0) {
      throw new Error(
        `This branch still holds records (${held.clients} clients, ${held.contracts} contracts, ${held.payments} payments, ${held.receipts} receipts). Deactivate it instead of deleting it.`
      );
    }

    // Unassign any users from this branch (also clears their position)
    const users = await ctx.db
      .query("users")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .collect();
    for (const u of users) {
      await ctx.db.patch(u._id, { branchId: undefined, position: undefined });
    }

    await ctx.db.delete(args.branchId);
    return { success: true };
  },
});

/**
 * Look a branch up by its (normalised) code. Codes are compared
 * case-insensitively so "mbs-001" and "MBS-001" are the same branch.
 */
async function findBranchByCode(
  ctx: { db: QueryCtx["db"] },
  code: string
) {
  const branches = await ctx.db.query("branches").collect();
  return (
    branches.find((b) => b.code.trim().toUpperCase() === code) ?? null
  );
}

/** How many branch-owned records a branch still holds. */
async function branchHistoryCounts(
  ctx: { db: QueryCtx["db"] },
  branchId: Id<"branches">
) {
  const [clients, contracts, payments, receipts] = await Promise.all([
    ctx.db
      .query("clients")
      .withIndex("by_branch", (q) => q.eq("branchId", branchId))
      .collect(),
    ctx.db
      .query("contracts")
      .withIndex("by_branch", (q) => q.eq("branchId", branchId))
      .collect(),
    ctx.db
      .query("payments")
      .withIndex("by_branch", (q) => q.eq("branchId", branchId))
      .collect(),
    ctx.db
      .query("receipts")
      .withIndex("by_branch", (q) => q.eq("branchId", branchId))
      .collect(),
  ]);
  return {
    clients: clients.length,
    contracts: contracts.length,
    payments: payments.length,
    receipts: receipts.length,
    total: clients.length + contracts.length + payments.length + receipts.length,
  };
}

/**
 * Transfer a planholder to another branch (Head Office only).
 *
 * What moves: the client record and the contracts they still hold, so the live
 * plan is serviced by the receiving branch from now on. A
 * `branch_transfer_history` row records who moved it, from where, and why.
 *
 * What deliberately does not move: `payments` and `receipts`. Collections stay
 * under the branch that actually recorded them, so no branch's historical
 * totals or reconciliation change because a planholder relocated. The full
 * ledger remains readable by the new branch because payment reads follow the
 * contract (see payments.list).
 */
export const transferClient = mutation({
  args: {
    clientId: v.id("clients"),
    toBranchId: v.id("branches"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!isAdminRole(user?.role ?? null)) {
      throw new Error(
        "Only the Super Admin or CEO can transfer a planholder between branches."
      );
    }

    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found.");
    const target = await ctx.db.get(args.toBranchId);
    if (!target) throw new Error("Branch not found.");
    if (!target.isActive) {
      throw new Error(`"${target.name}" is inactive, so it cannot receive records.`);
    }
    if (client.branchId === args.toBranchId) {
      throw new Error("This planholder already belongs to that branch.");
    }

    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    for (const contract of contracts) {
      await ctx.db.patch(contract._id, { branchId: args.toBranchId });
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    let retainedReceipts = 0;
    for (const payment of payments) {
      const receiptRows = await ctx.db
        .query("receipts")
        .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
        .collect();
      retainedReceipts += receiptRows.length;
    }

    await ctx.db.patch(args.clientId, { branchId: args.toBranchId });

    const historyId = await ctx.db.insert("branch_transfer_history", {
      clientId: args.clientId,
      fromBranchId: client.branchId,
      toBranchId: args.toBranchId,
      reason: args.reason,
      movedContracts: contracts.length,
      movedReceipts: 0,
      retainedPayments: payments.length,
      requestedBy: userId,
      requestedByName: user?.name ?? user?.email ?? "Unknown",
      createdAt: Date.now(),
    });

    await ctx.db.insert("audit_log", {
      action: "update",
      entityType: "client",
      entityId: args.clientId,
      userId,
      userName: user?.name ?? user?.email ?? "Unknown",
      description: `Planholder transferred: ${client.lastName}, ${client.firstName} → "${target.name}" (${contracts.length} contract(s) moved, ${payments.length} payment(s) kept with the recording branch)${args.reason ? ` — ${args.reason}` : ""}`,
      oldValues: { branchId: client.branchId ?? null },
      newValues: { branchId: args.toBranchId, reason: args.reason ?? null },
      branchId: args.toBranchId,
      timestamp: Date.now(),
    });

    return {
      historyId,
      movedContracts: contracts.length,
      retainedPayments: payments.length,
      retainedReceipts,
    };
  },
});

/**
 * Transfer trail — per client, or the most recent moves in the viewer's scope.
 * Branch staff only see moves into or out of their own branch.
 */
export const transferHistory = query({
  args: {
    clientId: v.optional(v.id("clients")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    const rows = args.clientId
      ? await ctx.db
          .query("branch_transfer_history")
          .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
          .collect()
      : await ctx.db
          .query("branch_transfer_history")
          .withIndex("by_createdAt")
          .order("desc")
          .take(args.limit ?? 50);

    const scoped = isAdminRole(viewer.role)
      ? rows
      : rows.filter(
          (r) =>
            r.toBranchId === viewer.branchId ||
            r.fromBranchId === viewer.branchId
        );

    // Resolve branch names and planholder names once per distinct id.
    const branchIds = Array.from(
      new Set(
        scoped
          .flatMap((r) => [r.fromBranchId, r.toBranchId])
          .filter(Boolean) as Id<"branches">[]
      )
    );
    const clientIds = Array.from(new Set(scoped.map((r) => r.clientId)));
    const [branches, clients] = await Promise.all([
      Promise.all(branchIds.map((id) => ctx.db.get(id))),
      Promise.all(clientIds.map((id) => ctx.db.get(id))),
    ]);
    const branchName = new Map(
      branchIds.map((id, i) => [id, branches[i]?.name ?? "Unknown branch"])
    );
    const clientName = new Map(
      clientIds.map((id, i) => {
        const c = clients[i];
        return [id, c ? `${c.lastName}, ${c.firstName}` : "Unknown planholder"];
      })
    );

    return scoped
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        ...r,
        fromBranchName: r.fromBranchId
          ? branchName.get(r.fromBranchId) ?? null
          : null,
        toBranchName: branchName.get(r.toBranchId) ?? "Unknown branch",
        clientName: clientName.get(r.clientId) ?? "Unknown planholder",
      }));
  },
});

/**
 * Assign clients (and everything attached to them) to a branch, or backfill
 * ALL records that currently have no branchId (legacy data) into one branch.
 *
 * CEO/Super Admin only. When a client is (re)assigned, its contracts,
 * payments, and receipts follow automatically so branch totals stay coherent.
 */
export const assignToBranch = mutation({
  args: {
    branchId: v.id("branches"),
    clientIds: v.optional(v.array(v.id("clients"))),
    assignUnassigned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!isAdminRole(user?.role ?? null)) {
      throw new Error("Only the Super Admin or CEO can assign records to branches.");
    }
    const branch = await ctx.db.get(args.branchId);
    if (!branch) throw new Error("Branch not found.");

    let clientIds = [...(args.clientIds ?? [])];
    if (args.assignUnassigned) {
      const unassignedClients = await ctx.db
        .query("clients")
        .filter((q) => q.eq(q.field("branchId"), undefined))
        .collect();
      clientIds = [
        ...clientIds,
        ...unassignedClients.map((c) => c._id),
      ];
    }

    let clients = 0;
    let contracts = 0;
    let payments = 0;
    let receipts = 0;

    for (const clientId of clientIds) {
      const client = await ctx.db.get(clientId);
      if (!client) continue;
      await ctx.db.patch(clientId, { branchId: args.branchId });
      clients++;

      const clientContracts = await ctx.db
        .query("contracts")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
      for (const contract of clientContracts) {
        await ctx.db.patch(contract._id, { branchId: args.branchId });
        contracts++;

        const contractPayments = await ctx.db
          .query("payments")
          .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
          .collect();
        for (const payment of contractPayments) {
          await ctx.db.patch(payment._id, { branchId: args.branchId });
          payments++;

          const paymentReceipts = await ctx.db
            .query("receipts")
            .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
            .collect();
          for (const receipt of paymentReceipts) {
            await ctx.db.patch(receipt._id, { branchId: args.branchId });
            receipts++;
          }
        }
      }
    }

    // Catch any orphaned records (contracts/payments without a client above,
    // or receipts whose payment is missing) in full-backfill mode.
    if (args.assignUnassigned) {
      const orphanContracts = await ctx.db
        .query("contracts")
        .filter((q) => q.eq(q.field("branchId"), undefined))
        .collect();
      for (const c of orphanContracts) {
        await ctx.db.patch(c._id, { branchId: args.branchId });
        contracts++;
      }

      const orphanPayments = await ctx.db
        .query("payments")
        .filter((q) => q.eq(q.field("branchId"), undefined))
        .collect();
      for (const p of orphanPayments) {
        await ctx.db.patch(p._id, { branchId: args.branchId });
        payments++;
      }

      const orphanReceipts = await ctx.db
        .query("receipts")
        .filter((q) => q.eq(q.field("branchId"), undefined))
        .collect();
      for (const r of orphanReceipts) {
        const payment = await ctx.db.get(r.paymentId);
        await ctx.db.patch(r._id, {
          branchId: payment?.branchId ?? args.branchId,
        });
        receipts++;
      }
    }

    await ctx.db.insert("audit_log", {
      action: "update",
      entityType: "client",
      entityId: "branch-assign",
      userId,
      userName: user?.name ?? user?.email ?? "Unknown",
      description: `Assigned ${clients} client(s) to "${branch.name}" (${contracts} contracts, ${payments} payments, ${receipts} receipts updated)`,
      newValues: {
        branchId: args.branchId,
        branchName: branch.name,
        assignUnassigned: args.assignUnassigned ?? false,
      },
      timestamp: Date.now(),
    });

    return { clients, contracts, payments, receipts };
  },
});
