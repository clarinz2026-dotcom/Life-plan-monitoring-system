import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  assertCanAccessRecord,
  assertStaff,
  resolveBranchFilter,
} from "./access";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const contractStatusValidator = v.union(
  v.literal("current"),
  v.literal("delinquent_30"),
  v.literal("delinquent_60"),
  v.literal("delinquent_90"),
  v.literal("lapsed"),
  v.literal("fully_paid"),
  v.literal("assigned_death_claim"),
);

/**
 * List contracts, optionally filtered by client or status.
 */
export const list = query({
  args: {
    clientId: v.optional(v.id("clients")),
    status: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    let contracts;

    if (branchId) {
      contracts = await ctx.db
        .query("contracts")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .order("desc")
        .collect();
      // Optionally narrow by client or status within the branch
      if (args.clientId) {
        contracts = contracts.filter((c) => String(c.clientId) === String(args.clientId));
      }
      if (args.status) {
        contracts = contracts.filter((c) => c.contractStatus === args.status);
      }
    } else if (args.clientId) {
      contracts = await ctx.db
        .query("contracts")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .order("desc")
        .collect();
    } else if (args.status) {
      contracts = await ctx.db
        .query("contracts")
        .withIndex("by_status", (q) =>
          q.eq("contractStatus", args.status as any)
        )
        .order("desc")
        .collect();
    } else {
      contracts = await ctx.db.query("contracts").order("desc").collect();
    }

    // Attach client info with one read per distinct client instead of one read
    // per contract (N+1).
    const clientIds = Array.from(new Set(contracts.map((c) => c.clientId)));
    const clientDocs = await Promise.all(clientIds.map((id) => ctx.db.get(id)));
    const clientById = new Map(
      clientIds.map((id, i) => [id, clientDocs[i]] as const)
    );

    return contracts.map((c) => ({
      ...c,
      client: clientById.get(c.clientId) ?? null,
    }));
  },
});

/**
 * Get a single contract with full details.
 */
export const get = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    await assertStaff(ctx);
    const contract = await ctx.db.get(args.contractId);
    if (!contract) return null;

    const client = await ctx.db.get(contract.clientId);
    return { ...contract, client };
  },
});

/**
 * Create a new contract for a client.
 */
export const create = mutation({
  args: {
    clientId: v.id("clients"),
    contractNumber: v.string(),
    planType: v.string(),
    planAmount: v.number(),
    monthlyAmortization: v.number(),
    startDate: v.number(),
    maturityDate: v.optional(v.number()),
    assignedAgent: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Auto-assign branchId from the current user's profile
    const currentUserDoc = await ctx.db.get(userId);
    const branchId = currentUserDoc?.branchId;

    // Get client's branch if available
    const clientDoc = await ctx.db.get(args.clientId);
    if (!clientDoc) throw new Error("Client not found");
    const clientBranchId = clientDoc?.branchId;

    // Branch staff may only create contracts for clients of their own branch.
    await assertCanAccessRecord(ctx, clientBranchId ?? branchId);

    const contractId = await ctx.db.insert("contracts", {
      ...args,
      branchId: branchId ?? clientBranchId ?? undefined,
      totalPaid: 0,
      contractStatus: "current",
      createdAt: Date.now(),
      createdBy: userId,
    });

    // Log audit entry
    const user = await ctx.db.get(userId);
    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "contract",
      entityId: contractId,
      userId,
      userName: user?.name || user?.email || "Unknown",
      description: `Contract ${args.contractNumber} created for ${args.planType} (${formatPHP(args.planAmount)})`,
      newValues: {
        contractNumber: args.contractNumber,
        planType: args.planType,
        planAmount: args.planAmount,
        monthlyAmortization: args.monthlyAmortization,
      },
      timestamp: Date.now(),
    });

    return contractId;
  },
});

/**
 * Update a contract's status.
 */
export const updateStatus = mutation({
  args: {
    contractId: v.id("contracts"),
    contractStatus: contractStatusValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const oldContract = await ctx.db.get(args.contractId);
    if (!oldContract) throw new Error("Contract not found");
    await assertCanAccessRecord(ctx, oldContract.branchId);
    const oldStatus = oldContract?.contractStatus;

    await ctx.db.patch(args.contractId, {
      contractStatus: args.contractStatus,
    });

    // Log audit entry
    if (oldStatus && oldStatus !== args.contractStatus) {
      const user = await ctx.db.get(userId);
      await ctx.db.insert("audit_log", {
        action: "status_change",
        entityType: "contract",
        entityId: args.contractId,
        userId,
        userName: user?.name || user?.email || "Unknown",
        description: `Contract status changed from "${oldStatus}" to "${args.contractStatus}"`,
        oldValues: { contractStatus: oldStatus },
        newValues: { contractStatus: args.contractStatus },
        timestamp: Date.now(),
      });
    }
  },
});
