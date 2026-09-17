import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  assertCanAccessRecord,
  assertRecordVisible,
  assertStaff,
  getViewer,
  isAdminRole,
  isManagerRole,
  resolveBranchFilter,
} from "./access";
import { effectiveRole } from "./roles";
import { lastLivePaymentDate } from "./paymentLedger";

/**
 * Compute delinquency status based on days since last payment.
 */
export function computeDelinquencyStatus(
  contractStatus: string,
  lastPaymentDate: number | null,
  totalPaid: number,
  planAmount: number,
  contractStartDate: number
): string {
  // If fully paid, keep the stored status.
  if (contractStatus === "fully_paid") {
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
    /** Include archived (soft-deleted) planholders. Off by default. */
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const search = args.search?.toLowerCase().trim();
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const includeArchived = args.includeArchived ?? false;

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

    // Archived planholders keep every contract, payment and receipt — they are
    // hidden from the working lists, not deleted.
    return includeArchived ? clients : clients.filter((c) => !c.archivedAt);
  },
});

/**
 * Get a single client by ID.
 */
export const get = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    // Client records hold beneficiary and contact PII — staff only, and only
    // the branch that owns the record. Without the branch check a branch user
    // could read another branch's planholder by pasting its id into the URL.
    const client = await ctx.db.get(args.clientId);
    if (!client) return null;
    await assertRecordVisible(ctx, client.branchId);
    return client;
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
 * Permanently delete planholders that have NO financial history.
 *
 * This is the escape hatch for genuinely mistaken records (a duplicate typed
 * into the wrong branch). Once a planholder has taken a payment, deletion is
 * refused and the caller must archive instead: payments, receipts and SOAs are
 * the company's financial record and the branch's collection history, and
 * permanently removing them would silently rewrite past reports and the
 * cashier's reconciliations.
 *
 * Head Office only — a Branch Manager can archive, but never erase.
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
    if (viewerRole !== "super_admin" && viewerRole !== "ceo") {
      throw new Error(
        "Only the Super Admin or CEO can permanently delete a planholder. Use Archive to remove a record from the working lists."
      );
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

      // Refuse to erase financial history.
      const contractsForGuard = await ctx.db
        .query("contracts")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
      let paymentCount = 0;
      for (const c of contractsForGuard) {
        paymentCount += (
          await ctx.db
            .query("payments")
            .withIndex("by_contract", (q) => q.eq("contractId", c._id))
            .collect()
        ).length;
      }
      const receiptCount = (
        await ctx.db
          .query("receipts")
          .withIndex("by_client", (q) => q.eq("clientId", clientId))
          .collect()
      ).length;

      if (paymentCount > 0 || receiptCount > 0) {
        throw new Error(
          `${client.lastName}, ${client.firstName} has ${paymentCount} recorded payment(s) and ${receiptCount} receipt(s). Financial history is never deleted — archive this planholder instead.`
        );
      }

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

      // Notifications for this client
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
 * Archive planholders (soft delete).
 *
 * Nothing is removed: the record, its contracts, payments, receipts and audit
 * trail all stay exactly as they are, and the planholder simply drops out of
 * the working lists. Head Office or a Branch Manager can archive; a branch can
 * only archive its own planholders.
 */
export const archive = mutation({
  args: {
    clientIds: v.array(v.id("clients")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    if (!isAdminRole(viewer.role) && !isManagerRole(viewer.role)) {
      throw new Error(
        "Only a Branch Manager or Head Office can archive a planholder."
      );
    }
    if (args.clientIds.length === 0) return { archived: 0, names: [] as string[] };

    const actor = await ctx.db.get(viewer.userId);
    const names: string[] = [];
    let touchedBranch: Id<"branches"> | undefined;

    for (const clientId of args.clientIds) {
      const client = await ctx.db.get(clientId);
      if (!client) continue;
      // Branch isolation applies to archiving too.
      await assertCanAccessRecord(ctx, client.branchId);
      if (client.archivedAt) continue;

      await ctx.db.patch(clientId, {
        archivedAt: Date.now(),
        archivedBy: viewer.userId,
        archiveReason: args.reason,
      });
      names.push(`${client.lastName}, ${client.firstName}`);
      touchedBranch = touchedBranch ?? client.branchId ?? undefined;
    }

    if (names.length > 0) {
      await ctx.db.insert("audit_log", {
        action: "delete", // "removed from the working lists"
        entityType: "client",
        entityId: args.clientIds.map(String).join(","),
        userId: viewer.userId,
        userName: actor?.name ?? actor?.email ?? "Unknown",
        description: `Archived ${names.length} planholder(s): ${names.join(", ")}${args.reason ? ` — ${args.reason}` : ""}`,
        newValues: { archived: names, reason: args.reason ?? null },
        branchId: touchedBranch,
        timestamp: Date.now(),
      });
    }

    return { archived: names.length, names };
  },
});

/**
 * Restore archived planholders. The inverse of `archive`, with the same scope
 * rules, so an archived record is never stranded.
 */
export const restore = mutation({
  args: { clientIds: v.array(v.id("clients")) },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    if (!isAdminRole(viewer.role) && !isManagerRole(viewer.role)) {
      throw new Error(
        "Only a Branch Manager or Head Office can restore a planholder."
      );
    }
    if (args.clientIds.length === 0) return { restored: 0, names: [] as string[] };

    const actor = await ctx.db.get(viewer.userId);
    const names: string[] = [];
    let touchedBranch: Id<"branches"> | undefined;

    for (const clientId of args.clientIds) {
      const client = await ctx.db.get(clientId);
      if (!client) continue;
      await assertCanAccessRecord(ctx, client.branchId);
      if (!client.archivedAt) continue;

      await ctx.db.patch(clientId, {
        archivedAt: undefined,
        archivedBy: undefined,
        archiveReason: undefined,
      });
      names.push(`${client.lastName}, ${client.firstName}`);
      touchedBranch = touchedBranch ?? client.branchId ?? undefined;
    }

    if (names.length > 0) {
      await ctx.db.insert("audit_log", {
        action: "status_change",
        entityType: "client",
        entityId: args.clientIds.map(String).join(","),
        userId: viewer.userId,
        userName: actor?.name ?? actor?.email ?? "Unknown",
        description: `Restored ${names.length} archived planholder(s): ${names.join(", ")}`,
        newValues: { restored: names },
        branchId: touchedBranch,
        timestamp: Date.now(),
      });
    }

    return { restored: names.length, names };
  },
});

/**
 * List clients with computed delinquency status based on actual payment dates.
 * Returns each client with their active contract and computed status.
 */
export const listWithStatus = query({
  args: {
    branchId: v.optional(v.id("branches")),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const includeArchived = args.includeArchived ?? false;
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

    if (!includeArchived) clients = clients.filter((c) => !c.archivedAt);

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
        (c) => c.contractStatus !== "fully_paid"
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

      // Most recent payment that still counts. Uses the compound
      // [contractId, paymentDate] index so we read a single row instead of the
      // contract's entire payment history (the old version also ordered by
      // creation time, which mis-reported the last payment date for back-dated
      // entries and skewed the delinquency status). Reversed payments are
      // skipped, so a plan whose latest entry was reversed falls back to the
      // payment before it.
      const lastPaymentDate = await lastLivePaymentDate(
        ctx,
        activeContract!._id
      );
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
