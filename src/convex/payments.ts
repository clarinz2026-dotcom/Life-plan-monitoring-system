import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { MutationCtx, mutation, query } from "./_generated/server";
import {
  assertCanAccessRecord,
  assertStaff,
  isAdminRole,
  isManagerRole,
  resolveBranchFilter,
} from "./access";
import { computeDelinquencyStatus } from "./clients";
import { lastLivePaymentDate } from "./paymentLedger";
import { effectiveRole } from "./roles";
import type { Id } from "./_generated/dataModel";

/**
 * How many payments one bulk call may touch.
 *
 * Every payment in a batch costs a handful of reads (the row, the access
 * check, its receipts), and Convex caps a single function at 32,000 documents.
 * The cap keeps a select-all on a busy branch well inside that budget and turns
 * an otherwise opaque server error into a message the user can act on.
 */
const MAX_BULK_PAYMENTS = 500;

/**
 * Legacy rows that carry no branch yet count as belonging to the viewer's own
 * branch, so branch staff never lose sight of their own history.
 */
function isRecordInBranch(
  recordBranchId: Id<"branches"> | undefined | null,
  viewerBranchId: Id<"branches">
) {
  return !recordBranchId || recordBranchId === viewerBranchId;
}

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Leave a plan where it really stands after money moved on or off its ledger.
 *
 * A reversal has to do more than subtract an amount: a plan that had been
 * marked fully paid drops back to its true delinquency status, recomputed from
 * the most recent *remaining* payment using the same thresholds the rest of the
 * app uses.
 *
 * Call this once per plan, after the whole batch of payment rows has been
 * written. `amountDelta` is the net change to what has been collected (negative
 * when money leaves the ledger). Reading the plan's newest live payment is then
 * a single indexed row, not a walk of its history — doing it per payment is
 * what blew past Convex's read limit on a large selection.
 */
async function recomputePlanLedger(
  ctx: MutationCtx,
  contractId: Id<"contracts">,
  amountDelta: number
) {
  const contract = await ctx.db.get(contractId);
  if (!contract) return null;

  const newTotalPaid = Math.max(0, contract.totalPaid + amountDelta);

  let contractStatus: string;
  if (amountDelta > 0 && newTotalPaid >= contract.planAmount) {
    contractStatus = "fully_paid";
  } else {
    // Never feed "fully_paid" in: the helper treats it as a status to preserve,
    // which is the opposite of what a reversal needs.
    const lastPaymentDate = await lastLivePaymentDate(ctx, contractId);
    contractStatus = computeDelinquencyStatus(
      contract.contractStatus === "fully_paid"
        ? "current"
        : contract.contractStatus,
      lastPaymentDate,
      newTotalPaid,
      contract.planAmount,
      contract.startDate
    );
  }

  await ctx.db.patch(contractId, {
    totalPaid: newTotalPaid,
    contractStatus: contractStatus as any,
  });

  return { newTotalPaid, contractStatus };
}

/** Validate a bulk selection before doing any work. */
function assertBulkSize(action: string, count: number) {
  if (count > MAX_BULK_PAYMENTS) {
    throw new Error(
      `You can ${action} up to ${MAX_BULK_PAYMENTS} payments at a time — ${count} were selected. Narrow the selection and try again.`
    );
  }
}

/** Void (archive) or re-issue the official receipt attached to a payment. */
async function setReceiptStatus(
  ctx: MutationCtx,
  paymentId: Id<"payments">,
  status: "active" | "cancelled"
) {
  const receipts = await ctx.db
    .query("receipts")
    .withIndex("by_payment", (q) => q.eq("paymentId", paymentId))
    .collect();
  for (const receipt of receipts) {
    await ctx.db.patch(receipt._id, { status });
  }
  return receipts.length;
}

const paymentChannelValidator = v.union(
  v.literal("cash"),
  v.literal("gcash"),
  v.literal("maya"),
  v.literal("bank_transfer"),
  v.literal("check"),
);

/**
 * List payments, optionally filtered by contract or client.
 */
export const list = query({
  args: {
    contractId: v.optional(v.id("contracts")),
    clientId: v.optional(v.id("clients")),
    branchId: v.optional(v.id("branches")),
    /** Include reversed (archived) payments. Off by default. */
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const includeArchived = args.includeArchived ?? false;
    let payments;

    if (branchId && (args.contractId || args.clientId)) {
      // A plan's own ledger is read through the plan/planholder it belongs to,
      // not by the branch that booked each payment. That keeps the full history
      // (and the SOA) visible to the branch that now services a transferred
      // planholder, while access is still checked against the contract's own
      // branch — so this cannot be used to read another branch's ledger.
      if (args.contractId) {
        const contract = await ctx.db.get(args.contractId);
        if (!contract || !isRecordInBranch(contract.branchId, branchId)) return [];
        payments = await ctx.db
          .query("payments")
          .withIndex("by_contract", (q) => q.eq("contractId", args.contractId!))
          .order("desc")
          .collect();
      } else {
        const client = await ctx.db.get(args.clientId!);
        if (!client || !isRecordInBranch(client.branchId, branchId)) return [];
        payments = await ctx.db
          .query("payments")
          .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
          .order("desc")
          .collect();
      }
    } else if (branchId) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .order("desc")
        .collect();
    } else if (args.contractId) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_contract", (q) =>
          q.eq("contractId", args.contractId!)
        )
        .order("desc")
        .collect();
    } else if (args.clientId) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .order("desc")
        .collect();
    } else {
      payments = await ctx.db.query("payments").order("desc").collect();
    }

    if (!includeArchived) payments = payments.filter((p) => !p.archivedAt);

    // Resolve the related records with one read per distinct document instead
    // of two reads for every payment (this list is unpaginated, so the old
    // version issued thousands of reads on a busy ledger).
    const contractIds = Array.from(new Set(payments.map((p) => p.contractId)));
    const clientIds = Array.from(new Set(payments.map((p) => p.clientId)));
    const [contractDocs, clientDocs] = await Promise.all([
      Promise.all(contractIds.map((id) => ctx.db.get(id))),
      Promise.all(clientIds.map((id) => ctx.db.get(id))),
    ]);
    const contractById = new Map(
      contractIds.map((id, i) => [id, contractDocs[i]] as const)
    );
    const clientById = new Map(
      clientIds.map((id, i) => [id, clientDocs[i]] as const)
    );

    return payments.map((p) => ({
      ...p,
      contract: contractById.get(p.contractId) ?? null,
      client: clientById.get(p.clientId) ?? null,
    }));
  },
});

/**
 * Record a new payment and auto-generate a receipt.
 */
export const record = mutation({
  args: {
    contractId: v.id("contracts"),
    amount: v.number(),
    paymentChannel: paymentChannelValidator,
    paymentDate: v.number(),
    orNumber: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    chequeNumber: v.optional(v.string()),
    bankName: v.optional(v.string()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");
    await assertCanAccessRecord(ctx, contract.branchId);

    const client = await ctx.db.get(contract.clientId);
    if (!client) throw new Error("Client not found");

    // Auto-assign branchId from contract or user
    const currentUserDoc = await ctx.db.get(userId);
    const branchId = contract.branchId ?? currentUserDoc?.branchId;

    // Insert payment
    const paymentId = await ctx.db.insert("payments", {
      contractId: args.contractId,
      clientId: contract.clientId,
      amount: args.amount,
      paymentChannel: args.paymentChannel,
      paymentDate: args.paymentDate,
      orNumber: args.orNumber,
      referenceNumber: args.referenceNumber,
      chequeNumber: args.chequeNumber,
      bankName: args.bankName,
      remarks: args.remarks,
      branchId,
      recordedBy: userId,
      createdAt: Date.now(),
    });

    // Update contract totalPaid and possibly status
    const newTotalPaid = contract.totalPaid + args.amount;
    const patch: Record<string, unknown> = { totalPaid: newTotalPaid };
    if (newTotalPaid >= contract.planAmount) {
      patch.contractStatus = "fully_paid";
    }
    await ctx.db.patch(args.contractId, patch);

    // Log audit entry
    const user = await ctx.db.get(userId);
    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "payment",
      entityId: paymentId,
      userId,
      userName: user?.name || user?.email || "Unknown",
      description: `Payment of ${formatPHP(args.amount)} recorded for contract ${contract.contractNumber}`,
      newValues: {
        amount: args.amount,
        paymentChannel: args.paymentChannel,
        paymentDate: args.paymentDate,
        contractNumber: contract.contractNumber,
        newTotalPaid,
      },
      timestamp: Date.now(),
    });

    // Generate a collision-safe receipt number: RCP-YYYYMMDD-XXXX.
    // Only that day's receipt numbers are read (index range) instead of the
    // whole receipts table, and the sequence is derived from the highest
    // existing number so deletions can never cause a duplicate.
    const now = new Date(args.paymentDate);
    const dateStr =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0");

    const prefix = `RCP-${dateStr}-`;
    const sameDayReceipts = await ctx.db
      .query("receipts")
      .withIndex("by_receiptNumber", (q) =>
        q.gte("receiptNumber", prefix).lt("receiptNumber", `${prefix}\uffff`)
      )
      .collect();
    let maxSeq = 0;
    for (const r of sameDayReceipts) {
      const seq = parseInt(r.receiptNumber.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    const receiptNumber = `${prefix}${(maxSeq + 1).toString().padStart(4, "0")}`;

    const fullName = client.middleName
      ? `${client.lastName}, ${client.firstName} ${client.middleName}`
      : `${client.lastName}, ${client.firstName}`;

    const receiptId = await ctx.db.insert("receipts", {
      paymentId,
      contractId: args.contractId,
      clientId: contract.clientId,
      receiptNumber,
      amount: args.amount,
      paymentChannel: args.paymentChannel,
      paymentDate: args.paymentDate,
      issuedTo: fullName,
      planType: contract.planType,
      contractNumber: contract.contractNumber,
      status: "active",
      issuedBy: userId,
      branchId,
      createdAt: Date.now(),
    });

    return { paymentId, receiptId, receiptNumber };
  },
});

/**
 * Reverse a recorded payment (soft delete).
 *
 * Erasing a payment would silently rewrite past collections, the receipts
 * already handed to families, and the cashier's closed reconciliations. A
 * reversal therefore archives the row: the amount comes off the plan, the
 * receipt is cancelled, and the entry stays in the ledger to be restored.
 *
 * Branch Manager or Head Office, and only for the caller's own branch.
 */
export const archive = mutation({
  args: {
    paymentIds: v.array(v.id("payments")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    if (!isAdminRole(viewer.role) && !isManagerRole(viewer.role)) {
      throw new Error(
        "Only a Branch Manager or Head Office can reverse a payment."
      );
    }
    if (args.paymentIds.length === 0) {
      return { archived: 0, amount: 0, summaries: [] as string[] };
    }
    assertBulkSize("reverse", args.paymentIds.length);

    const actor = await ctx.db.get(viewer.userId);
    const summaries: string[] = [];
    let reversedAmount = 0;
    let touchedBranch: Id<"branches"> | undefined;
    /** Net amount each plan loses, applied in one pass at the end. */
    const deltasByPlan = new Map<Id<"contracts">, number>();

    for (const paymentId of args.paymentIds) {
      const payment = await ctx.db.get(paymentId);
      if (!payment) continue;
      // Branch isolation applies to reversing a payment too.
      await assertCanAccessRecord(ctx, payment.branchId);
      if (payment.archivedAt) continue;

      const contract = await ctx.db.get(payment.contractId);
      if (!contract) continue;

      await ctx.db.patch(paymentId, {
        archivedAt: Date.now(),
        archivedBy: viewer.userId,
        archiveReason: args.reason,
      });
      await setReceiptStatus(ctx, paymentId, "cancelled");

      deltasByPlan.set(
        payment.contractId,
        (deltasByPlan.get(payment.contractId) ?? 0) - payment.amount
      );

      summaries.push(`${formatPHP(payment.amount)} on ${contract.contractNumber}`);
      reversedAmount += payment.amount;
      touchedBranch = touchedBranch ?? payment.branchId ?? undefined;
    }

    // One recompute per plan, after every row in the batch has left the ledger.
    for (const [contractId, delta] of deltasByPlan) {
      await recomputePlanLedger(ctx, contractId, delta);
    }

    if (summaries.length > 0) {
      await ctx.db.insert("audit_log", {
        action: "delete", // reversed out of the working ledger
        entityType: "payment",
        entityId: args.paymentIds.map(String).join(","),
        userId: viewer.userId,
        userName: actor?.name ?? actor?.email ?? "Unknown",
        description: `Reversed ${summaries.length} payment(s) totalling ${formatPHP(reversedAmount)}: ${summaries.join(", ")}${args.reason ? ` — ${args.reason}` : ""}`,
        newValues: {
          reversed: summaries,
          reversedAmount,
          reason: args.reason ?? null,
        },
        branchId: touchedBranch,
        timestamp: Date.now(),
      });
    }

    return { archived: summaries.length, amount: reversedAmount, summaries };
  },
});

/**
 * Restore a reversed payment: the amount goes back onto the plan and the
 * receipt is re-issued. Same scope rules as `archive`.
 */
export const restore = mutation({
  args: { paymentIds: v.array(v.id("payments")) },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    if (!isAdminRole(viewer.role) && !isManagerRole(viewer.role)) {
      throw new Error(
        "Only a Branch Manager or Head Office can restore a payment."
      );
    }
    if (args.paymentIds.length === 0) return { restored: 0 };
    assertBulkSize("restore", args.paymentIds.length);

    const actor = await ctx.db.get(viewer.userId);
    const summaries: string[] = [];
    let touchedBranch: Id<"branches"> | undefined;
    /** Net amount each plan gains back, applied in one pass at the end. */
    const deltasByPlan = new Map<Id<"contracts">, number>();

    for (const paymentId of args.paymentIds) {
      const payment = await ctx.db.get(paymentId);
      if (!payment) continue;
      await assertCanAccessRecord(ctx, payment.branchId);
      if (!payment.archivedAt) continue;

      await ctx.db.patch(paymentId, {
        archivedAt: undefined,
        archivedBy: undefined,
        archiveReason: undefined,
      });
      await setReceiptStatus(ctx, paymentId, "active");

      deltasByPlan.set(
        payment.contractId,
        (deltasByPlan.get(payment.contractId) ?? 0) + payment.amount
      );

      summaries.push(`${formatPHP(payment.amount)} restored`);
      touchedBranch = touchedBranch ?? payment.branchId ?? undefined;
    }

    for (const [contractId, delta] of deltasByPlan) {
      await recomputePlanLedger(ctx, contractId, delta);
    }

    if (summaries.length > 0) {
      await ctx.db.insert("audit_log", {
        action: "update",
        entityType: "payment",
        entityId: args.paymentIds.map(String).join(","),
        userId: viewer.userId,
        userName: actor?.name ?? actor?.email ?? "Unknown",
        description: `Restored ${summaries.length} previously reversed payment(s)`,
        newValues: { restored: summaries },
        branchId: touchedBranch,
        timestamp: Date.now(),
      });
    }

    return { restored: summaries.length };
  },
});

/**
 * Permanently delete reversed payments.
 *
 * Head Office only, mirroring `clients.bulkDelete`: a Branch Manager may
 * reverse a payment, but only the Super Admin or CEO can erase it. The amount
 * still comes off the plan and the receipt is removed with the row.
 */
export const remove = mutation({
  args: { paymentIds: v.array(v.id("payments")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const actor = await ctx.db.get(userId);
    const viewerRole = effectiveRole(actor);
    if (viewerRole !== "super_admin" && viewerRole !== "ceo") {
      throw new Error(
        "Only the Super Admin or CEO can permanently delete a payment. Use Reverse to take it out of the ledger while keeping the record."
      );
    }
    if (args.paymentIds.length === 0) return { deleted: 0 };
    assertBulkSize("delete", args.paymentIds.length);

    const summaries: string[] = [];
    let touchedBranch: Id<"branches"> | undefined;
    /** Net amount each plan loses because a not-yet-reversed row is erased. */
    const deltasByPlan = new Map<Id<"contracts">, number>();

    for (const paymentId of args.paymentIds) {
      const payment = await ctx.db.get(paymentId);
      if (!payment) continue;
      await assertCanAccessRecord(ctx, payment.branchId);

      const contract = await ctx.db.get(payment.contractId);
      if (contract && !payment.archivedAt) {
        // Not reversed yet — the amount comes off the plan once the row is
        // gone (applied in the per-plan pass below).
        deltasByPlan.set(
          payment.contractId,
          (deltasByPlan.get(payment.contractId) ?? 0) - payment.amount
        );
      }

      const receipts = await ctx.db
        .query("receipts")
        .withIndex("by_payment", (q) => q.eq("paymentId", paymentId))
        .collect();
      for (const receipt of receipts) await ctx.db.delete(receipt._id);

      summaries.push(`${formatPHP(payment.amount)} on ${contract?.contractNumber ?? "unknown plan"}`);
      touchedBranch = touchedBranch ?? payment.branchId ?? undefined;

      await ctx.db.delete(paymentId);
    }

    for (const [contractId, delta] of deltasByPlan) {
      await recomputePlanLedger(ctx, contractId, delta);
    }

    if (summaries.length > 0) {
      await ctx.db.insert("audit_log", {
        action: "delete",
        entityType: "payment",
        entityId: args.paymentIds.map(String).join(","),
        userId,
        userName: actor?.name ?? actor?.email ?? "Unknown",
        description: `Permanently deleted ${summaries.length} payment(s): ${summaries.join(", ")}`,
        newValues: { deleted: summaries },
        branchId: touchedBranch,
        timestamp: Date.now(),
      });
    }

    return { deleted: summaries.length };
  },
});

/**\ * Bulk-record multiple payments in one call.\ *\ * The frontend parses the CSV/Excel file and sends the validated rows as
 * an array. Each row is processed the same way as a single `record` call:
 * the contract's totalPaid is bumped, a receipt is generated, and an audit
 * entry is written.\ *\ * The caller must be authenticated staff.\ */
const bulkPaymentItem = v.object({
  contractId: v.id("contracts"),
  amount: v.number(),
  paymentChannel: paymentChannelValidator,
  paymentDate: v.number(),
  orNumber: v.optional(v.string()),
  referenceNumber: v.optional(v.string()),
  chequeNumber: v.optional(v.string()),
  bankName: v.optional(v.string()),
  remarks: v.optional(v.string()),
});

export const bulkRecord = mutation({
  args: {
    payments: v.array(bulkPaymentItem),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.payments.length === 0)
      return { recorded: 0, receipts: 0, errors: [] as string[] };
    if (args.payments.length > MAX_BULK_PAYMENTS) {
      throw new Error(
        `You can record up to ${MAX_BULK_PAYMENTS} payments at a time — ${args.payments.length} were provided. Split the file and try again.`
      );
    }

    const actor = await ctx.db.get(userId);
    const errors: string[] = [];
    let recorded = 0;
    let receiptCount = 0;
    /** Net amount each plan gains, applied in one pass at the end. */
    const deltasByPlan = new Map<Id<"contracts">, number>();
    const touchedBranch = new Set<Id<"branches">>();

    for (let i = 0; i < args.payments.length; i++) {
      const item = args.payments[i];
      try {
        const contract = await ctx.db.get(item.contractId);
        if (!contract) {
          errors.push(`Row ${i + 1}: contract not found`);
          continue;
        }
        await assertCanAccessRecord(ctx, contract.branchId);

        const client = await ctx.db.get(contract.clientId);
        if (!client) {
          errors.push(`Row ${i + 1}: client not found for contract ${contract.contractNumber}`);
          continue;
        }

        const branchId = contract.branchId ?? actor?.branchId;
        if (branchId) touchedBranch.add(branchId);

        // Insert payment
        const paymentId = await ctx.db.insert("payments", {
          contractId: item.contractId,
          clientId: contract.clientId,
          amount: item.amount,
          paymentChannel: item.paymentChannel,
          paymentDate: item.paymentDate,
          orNumber: item.orNumber,
          referenceNumber: item.referenceNumber,
          chequeNumber: item.chequeNumber,
          bankName: item.bankName,
          remarks: item.remarks,
          branchId,
          recordedBy: userId,
          createdAt: Date.now(),
        });

        deltasByPlan.set(
          item.contractId,
          (deltasByPlan.get(item.contractId) ?? 0) + item.amount
        );

        // Generate receipt
        const now = new Date(item.paymentDate);
        const dateStr =
          now.getFullYear().toString() +
          (now.getMonth() + 1).toString().padStart(2, "0") +
          now.getDate().toString().padStart(2, "0");
        const prefix = `RCP-${dateStr}-`;
        const sameDayReceipts = await ctx.db
          .query("receipts")
          .withIndex("by_receiptNumber", (q) =>
            q.gte("receiptNumber", prefix).lt("receiptNumber", `${prefix}\uffff`)
          )
          .collect();
        let maxSeq = 0;
        for (const r of sameDayReceipts) {
          const seq = parseInt(r.receiptNumber.slice(prefix.length), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
        const receiptNumber = `${prefix}${(maxSeq + 1).toString().padStart(4, "0")}`;

        const fullName = client.middleName
          ? `${client.lastName}, ${client.firstName} ${client.middleName}`
          : `${client.lastName}, ${client.firstName}`;

        await ctx.db.insert("receipts", {
          paymentId,
          contractId: item.contractId,
          clientId: contract.clientId,
          receiptNumber,
          amount: item.amount,
          paymentChannel: item.paymentChannel,
          paymentDate: item.paymentDate,
          issuedTo: fullName,
          planType: contract.planType,
          contractNumber: contract.contractNumber,
          status: "active",
          issuedBy: userId,
          branchId,
          createdAt: Date.now(),
        });

        receiptCount++;
        recorded++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err?.message || "unknown error"}`);
      }
    }

    // Recompute each affected plan once
    for (const [contractId, delta] of deltasByPlan) {
      await recomputePlanLedger(ctx, contractId, delta);
    }

    if (recorded > 0) {
      await ctx.db.insert("audit_log", {
        action: "create",
        entityType: "payment",
        entityId: "bulk-import",
        userId,
        userName: actor?.name ?? actor?.email ?? "Unknown",
        description: `Bulk-recorded ${recorded} payment(s) totalling ${formatPHP(
          [...deltasByPlan.values()].reduce((s, v) => s + v, 0)
        )}${errors.length > 0 ? ` (${errors.length} row(s) skipped)` : ""}`,
        newValues: { bulkCount: recorded, errorCount: errors.length },
        timestamp: Date.now(),
      });
    }

    return { recorded, receipts: receiptCount, errors };
  },
});
