import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanAccessRecord, resolveBranchFilter } from "./access";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
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
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    let payments;

    if (branchId) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .order("desc")
        .collect();
      if (args.contractId) {
        payments = payments.filter((p) => String(p.contractId) === String(args.contractId));
      }
      if (args.clientId) {
        payments = payments.filter((p) => String(p.clientId) === String(args.clientId));
      }
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
