import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanAccessRecord, resolveBranchFilter } from "./access";
import { liveOnly } from "./paymentLedger";
import { MS_PER_DAY, manilaDayStart } from "./datetime";

/**
 * Start/end-of-day reconciliation.
 * Creates a new reconciliation record with actual amounts and computes variance.
 */
export const create = mutation({
  args: {
    totalCash: v.number(),
    totalGCash: v.number(),
    totalMaya: v.number(),
    totalBankTransfer: v.number(),
    totalCheck: v.number(),
    totalActual: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);

    // The cashier counts the drawer at close of business in Manila, so "today"
    // must be the Manila calendar day — the server clock is UTC.
    const todayStart = manilaDayStart();
    const todayEnd = todayStart + MS_PER_DAY;

    // Get all payments recorded today (scoped to the cashier's branch).
    // Reversed payments are excluded — they are not in the drawer.
    const todayPayments = liveOnly(
      await ctx.db
        .query("payments")
        .withIndex("by_paymentDate", (q) =>
          q.gte("paymentDate", todayStart).lt("paymentDate", todayEnd)
        )
        .collect()
    ).filter((p) => !user?.branchId || p.branchId === user.branchId);

    const totalRecorded = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    const totalRecordedBreakdown = {
      cash: todayPayments
        .filter((p) => p.paymentChannel === "cash")
        .reduce((sum, p) => sum + p.amount, 0),
      gcash: todayPayments
        .filter((p) => p.paymentChannel === "gcash")
        .reduce((sum, p) => sum + p.amount, 0),
      maya: todayPayments
        .filter((p) => p.paymentChannel === "maya")
        .reduce((sum, p) => sum + p.amount, 0),
      bank_transfer: todayPayments
        .filter((p) => p.paymentChannel === "bank_transfer")
        .reduce((sum, p) => sum + p.amount, 0),
      check: todayPayments
        .filter((p) => p.paymentChannel === "check")
        .reduce((sum, p) => sum + p.amount, 0),
    };

    const variance = args.totalActual - totalRecorded;

    const reconciliationId = await ctx.db.insert("daily_reconciliation", {
      cashierId: userId,
      reconciliationDate: todayStart,
      // Stamp the branch whose collections were counted, so Head Office can
      // filter reconciliations per branch and the branch keeps its own sheet.
      branchId: user?.branchId ?? undefined,
      totalCash: args.totalCash,
      totalGCash: args.totalGCash,
      totalMaya: args.totalMaya,
      totalBankTransfer: args.totalBankTransfer,
      totalCheck: args.totalCheck,
      totalRecorded,
      totalActual: args.totalActual,
      variance,
      status: "closed",
      notes: args.notes,
      createdAt: Date.now(),
    });

    return {
      reconciliationId,
      totalRecorded,
      variance,
      recordedBreakdown: totalRecordedBreakdown,
      paymentCount: todayPayments.length,
    };
  },
});

/**
 * List reconciliations, optionally filtered by cashier.
 */
export const list = query({
  args: {
    cashierId: v.optional(v.id("users")),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);

    let records;

    if (args.cashierId) {
      records = await ctx.db
        .query("daily_reconciliation")
        .withIndex("by_cashier", (q) => q.eq("cashierId", args.cashierId!))
        .order("desc")
        .collect();
    } else {
      records = await ctx.db
        .query("daily_reconciliation")
        .withIndex("by_date")
        .order("desc")
        .collect();
    }

    // Filter by branch through each cashier's assignment. Every distinct
    // cashier is read once (in parallel) rather than once per row.
    const cashierIds = Array.from(new Set(records.map((r) => r.cashierId)));
    const cashierDocs = await Promise.all(
      cashierIds.map((id) => ctx.db.get(id))
    );
    const cashierById = new Map(
      cashierDocs.filter(Boolean).map((c) => [c!._id, c!] as const)
    );

    const enriched = [];
    for (const r of records) {
      const cashier = cashierById.get(r.cashierId);
      if (branchId && cashier?.branchId !== branchId) continue;
      enriched.push({
        ...r,
        cashierName: cashier?.name || cashier?.email || "Unknown",
      });
    }

    return enriched;
  },
});

/**
 * Review a reconciliation (manager/CEO).
 */
export const review = mutation({
  args: {
    reconciliationId: v.id("daily_reconciliation"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const record = await ctx.db.get(args.reconciliationId);
    if (!record) throw new Error("Reconciliation record not found");
    const cashier = await ctx.db.get(record.cashierId);
    await assertCanAccessRecord(ctx, cashier?.branchId ?? undefined);

    await ctx.db.patch(args.reconciliationId, {
      status: "reviewed",
      reviewedBy: userId,
      reviewedAt: Date.now(),
      notes: args.notes,
    });

    return { success: true };
  },
});

/**
 * Get today's summary, optionally filtered by branch.
 */
export const todaySummary = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    // Manila day window — matches what the branch actually collected today.
    const todayStart = manilaDayStart();
    const todayEnd = todayStart + MS_PER_DAY;

    let payments = liveOnly(
      await ctx.db
        .query("payments")
        .withIndex("by_paymentDate", (q) =>
          q.gte("paymentDate", todayStart).lt("paymentDate", todayEnd)
        )
        .collect()
    );
    if (branchId) {
      payments = payments.filter((p) => p.branchId === branchId);
    }

    const byChannel = {
      cash: payments.filter((p) => p.paymentChannel === "cash").reduce((s, p) => s + p.amount, 0),
      gcash: payments.filter((p) => p.paymentChannel === "gcash").reduce((s, p) => s + p.amount, 0),
      maya: payments.filter((p) => p.paymentChannel === "maya").reduce((s, p) => s + p.amount, 0),
      bank_transfer: payments.filter((p) => p.paymentChannel === "bank_transfer").reduce((s, p) => s + p.amount, 0),
      check: payments.filter((p) => p.paymentChannel === "check").reduce((s, p) => s + p.amount, 0),
    };

    const total = payments.reduce((s, p) => s + p.amount, 0);

    return { total, count: payments.length, byChannel };
  },
});
