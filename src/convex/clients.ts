import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  assertCanAccessRecord,
  assertStaff,
  getViewer,
  isAdminRole,
  resolveBranchFilter,
} from "./access";
import { effectiveRole } from "./roles";

/**
 * Compute delinquency status based on days since last payment.
 */
function computeDelinquencyStatus(
  contractStatus: string,
  lastPaymentDate: number | null,
  totalPaid: number,
  planAmount: number,
  contractStartDate: number
): string {
  // If fully paid or death claim, keep stored status
  if (contractStatus === "fully_paid" || contractStatus === "assigned_death_claim") {
    return contractStatus;
  }

  // If totalPaid >= planAmount, it's fully paid
  if (totalPaid >= planAmount) {
    return "fully_paid";
  }

  // Determine reference date: last payment or contract start
  const referenceDate = lastPaymentDate ?? contractStartDate;
  const now = Date.now();
  const daysSince = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));

  if (daysSince > 120) return "lapsed";
  if (daysSince > 90) return "delinquent_90";
  if (daysSince > 60) return "delinquent_60";
  if (daysSince > 30) return "delinquent_30";
  return "current";
}

/**
 * List all clients with optional search.
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const search = args.search?.toLowerCase().trim();
    const branchId = await resolveBranchFilter(ctx, args.branchId);

    let clients;
    if (branchId) {
      clients = await ctx.db
        .query("clients")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .order("desc")
        .collect();
    } else if (search) {
      // Search by last name
      clients = await ctx.db
        .query("clients")
        .withIndex("by_lastName")
        .collect();
      clients = clients.filter(
        (c) =>
          c.lastName.toLowerCase().includes(search) ||
          c.firstName.toLowerCase().includes(search) ||
          (c.contactNumber || "").toLowerCase().includes(search)
      );
    } else {
      clients = await ctx.db
        .query("clients")
        .withIndex("by_createdAt")
        .order("desc")
        .collect();
    }

    if (search && branchId) {
      clients = clients.filter(
        (c) =>
          c.lastName.toLowerCase().includes(search) ||
          c.firstName.toLowerCase().includes(search) ||
          (c.contactNumber || "").toLowerCase().includes(search)
      );
    }

    return clients;
  },
});

/**
 * Get a single client by ID.
 */
export const get = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    // Client records hold beneficiary and contact PII — staff only. (This used
    // to be open to anyone, including anonymous callers, given a client id.)
    await assertStaff(ctx);
    return await ctx.db.get(args.clientId);
  },
});

/**
 * Create a new client.
 */
export const create = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    middleName: v.optional(v.string()),
    dateOfBirth: v.number(),
    gender: v.union(v.literal("male"), v.literal("female"), v.literal("other")),
    contactNumber: v.string(),
    email: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    province: v.string(),
    zipCode: v.string(),
    occupation: v.optional(v.string()),
    beneficiaryName: v.string(),
    beneficiaryRelationship: v.string(),
    beneficiaryContact: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Auto-assign branchId from the current user's profile
    const currentUserDoc = await ctx.db.get(userId);
    const branchId = currentUserDoc?.branchId;

    return await ctx.db.insert("clients", {
      ...args,
      branchId,
      createdAt: Date.now(),
      createdBy: userId,
    });
  },
});

/**
 * Update an existing client.
 */
export const update = mutation({
  args: {
    clientId: v.id("clients"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    gender: v.optional(
      v.union(v.literal("male"), v.literal("female"), v.literal("other"))
    ),
    contactNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    province: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    occupation: v.optional(v.string()),
    beneficiaryName: v.optional(v.string()),
    beneficiaryRelationship: v.optional(v.string()),
    beneficiaryContact: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Reassign the client to another branch (CEO/Super Admin only).
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { clientId, ...updates } = args;

    const client = await ctx.db.get(clientId);
    if (!client) throw new Error("Client not found");
    const viewer = await assertCanAccessRecord(ctx, client.branchId);

    // Only admins may change the branch assignment.
    const { branchId, ...rest } = updates;
    if (branchId !== undefined) {
      if (!isAdminRole(viewer.role)) {
        throw new Error("Only the Super Admin or CEO can reassign a client to a branch.");
      }
      const target = await ctx.db.get(branchId);
      if (!target) throw new Error("Branch not found.");
    }

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    );
    if (branchId !== undefined) cleanUpdates.branchId = branchId;
    if (Object.keys(cleanUpdates).length === 0) return;

    await ctx.db.patch(clientId, cleanUpdates);
  },
});

/**
 * Permanently delete multiple clients and everything attached to them:
 * contracts, payments, receipts, payment schedules, death claims, and
 * notifications. Audit logs are kept for history.
 *
 * Restricted to Super Admin, CEO, and Manager.
 */
export const bulkDelete = mutation({
  args: {
    clientIds: v.array(v.id("clients")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    const viewerRole = effectiveRole(user);
    if (
      viewerRole !== "super_admin" &&
      viewerRole !== "ceo" &&
      viewerRole !== "manager"
    ) {
      throw new Error("Only the Super Admin, CEO, or Manager can delete clients.");
    }

    if (args.clientIds.length === 0) return { deleted: 0, names: [] as string[] };

    const deletedNames: string[] = [];
    let totalContracts = 0;
    let totalPayments = 0;

    for (const clientId of args.clientIds) {
      const client = await ctx.db.get(clientId);
      if (!client) continue;
      // Branch staff may only delete clients from their own branch.
      await assertCanAccessRecord(ctx, client.branchId);
      deletedNames.push(`${client.lastName}, ${client.firstName}`);

      // All contracts for this client → their payments and schedules
      const contracts = await ctx.db
        .query("contracts")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();

      const paymentIds: Id<"payments">[] = [];
      for (const contract of contracts) {
        const payments = await ctx.db
          .query("payments")
          .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
          .collect();
        paymentIds.push(...payments.map((p) => p._id));

        const schedules = await ctx.db
          .query("payment_schedules")
          .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
          .collect();
        for (const s of schedules) await ctx.db.delete(s._id);

        await ctx.db.delete(contract._id);
        totalContracts++;
      }

      // Receipts for this client (deletes all of the client's receipts)
      const receipts = await ctx.db
        .query("receipts")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
      for (const r of receipts) await ctx.db.delete(r._id);

      // Payments (any that weren't covered above are removed here)
      for (const paymentId of paymentIds) {
        await ctx.db.delete(paymentId);
        totalPayments++;
      }

      // Death claims, route stops, notifications for this client
      const claims = await ctx.db
        .query("death_claims")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
      for (const claim of claims) await ctx.db.delete(claim._id);

      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
      for (const n of notifications) await ctx.db.delete(n._id);

      await ctx.db.delete(clientId);
    }

    // One audit entry summarizing the deletion
    await ctx.db.insert("audit_log", {
      action: "delete",
      entityType: "client",
      entityId: args.clientIds.map(String).join(","),
      userId,
      userName: user?.name ?? user?.email ?? "Unknown",
      description: `Bulk deleted ${deletedNames.length} client(s) (${totalContracts} contracts, ${totalPayments} payments removed)`,
      newValues: {
        clients: deletedNames,
        contractsRemoved: totalContracts,
        paymentsRemoved: totalPayments,
      },
      timestamp: Date.now(),
    });

    return { deleted: deletedNames.length, names: deletedNames };
  },
});

/**
 * List clients with computed delinquency status based on actual payment dates.
 * Returns each client with their active contract and computed status.
 */
export const listWithStatus = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    let clients;
    if (branchId) {
      clients = await ctx.db
        .query("clients")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .order("desc")
        .collect();
    } else {
      clients = await ctx.db
        .query("clients")
        .withIndex("by_createdAt")
        .order("desc")
        .collect();
    }

    const now = Date.now();
    const results = [];

    for (const client of clients) {
      // Get all contracts for this client
      const contracts = await ctx.db
        .query("contracts")
        .withIndex("by_client", (q) => q.eq("clientId", client._id))
        .collect();

      // Pick the best active contract (prefer non-fully-paid)
      let activeContract = contracts.find(
        (c) => c.contractStatus !== "fully_paid" && c.contractStatus !== "assigned_death_claim"
      );
      if (!activeContract && contracts.length > 0) {
        activeContract = contracts[0];
      }

      if (!activeContract) {
        results.push({
          client,
          contract: null,
          computedStatus: "no_contract",
          lastPaymentDate: null,
          daysSincePayment: null,
        });
        continue;
      }

      // Most recent payment for this contract. Uses the compound
      // [contractId, paymentDate] index so we read a single row instead of the
      // contract's entire payment history (the old version also ordered by
      // creation time, which mis-reported the last payment date for back-dated
      // entries and skewed the delinquency status).
      const lastPayment = await ctx.db
        .query("payments")
        .withIndex("by_contract_paymentDate", (q) =>
          q.eq("contractId", activeContract!._id)
        )
        .order("desc")
        .take(1);

      const lastPaymentDate = lastPayment[0]?.paymentDate ?? null;
      const daysSincePayment = lastPaymentDate
        ? Math.floor((now - lastPaymentDate) / (1000 * 60 * 60 * 24))
        : null;

      const computedStatus = computeDelinquencyStatus(
        activeContract.contractStatus,
        lastPaymentDate,
        activeContract.totalPaid,
        activeContract.planAmount,
        activeContract.startDate
      );

      results.push({
        client,
        contract: activeContract,
        computedStatus,
        lastPaymentDate,
        daysSincePayment,
      });
    }

    return results;
  },
});
