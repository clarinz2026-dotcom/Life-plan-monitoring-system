import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    let payments;

    if (args.branchId) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_branch", (q) => q.eq("branchId", args.branchId!))
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

    const enriched = await Promise.all(
      payments.map(async (p) => {
        const contract = await ctx.db.get(p.contractId);
        const client = await ctx.db.get(p.clientId);
        return { ...p, contract, client };
      })
    );

    return enriched;
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

    // Generate receipt number: RCP-YYYYMMDD-XXXX
    const now = new Date(args.paymentDate);
    const dateStr =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0");

    const allReceipts = await ctx.db.query("receipts").collect();
    const seq = allReceipts.length + 1;
    const receiptNumber = `RCP-${dateStr}-${seq.toString().padStart(4, "0")}`;

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
      createdAt: Date.now(),
    });

    return { paymentId, receiptId, receiptNumber };
  },
});
