import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanAccessRecord, getViewer, isAdminRole } from "./access";

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
    managerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!isAdminRole(user?.role ?? null)) {
      throw new Error("Only the Super Admin or CEO can create branches.");
    }

    const branchId = await ctx.db.insert("branches", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });

    return { branchId };
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
    const viewer = await getViewer(ctx);
    if (!viewer) throw new Error("Not authenticated");

    const branches = await ctx.db.query("branches").collect();

    const enriched = await Promise.all(
      branches.map(async (b) => {
        const manager = b.managerId ? await ctx.db.get(b.managerId) : null;
        return {
          ...b,
          managerName: manager?.name || manager?.email || null,
        };
      })
    );

    return enriched;
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
    if (Object.keys(clean).length === 0) return;

    await ctx.db.patch(branchId, clean);
    return { success: true };
  },
});

/**
 * Get a single branch (staff only).
 */
export const get = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx);
    if (!viewer) throw new Error("Not authenticated");
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!isAdminRole(user?.role ?? null)) {
      throw new Error("Only the Super Admin or CEO can view branch performance.");
    }

    const branches = await ctx.db.query("branches").collect();
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(), 1
    ).getTime();

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
        const allUsers = await ctx.db.query("users").collect();
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

    // Check if any clients are assigned
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_branch", (q) => q.eq("branchId", args.branchId))
      .first();
    if (clients) {
      throw new Error("Cannot delete a branch that still has assigned clients. Reassign them first.");
    }

    // Unassign any users from this branch (also clears their position)
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      if (u.branchId === args.branchId) {
        await ctx.db.patch(u._id, { branchId: undefined, position: undefined });
      }
    }

    await ctx.db.delete(args.branchId);
    return { success: true };
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
