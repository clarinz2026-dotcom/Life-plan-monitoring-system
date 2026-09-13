import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertStaff, resolveBranchFilter } from "./access";

/**
 * List receipts, optionally filtered by client or branch.
 */
export const list = query({
  args: {
    clientId: v.optional(v.id("clients")),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    let receipts;

    if (args.clientId) {
      receipts = await ctx.db
        .query("receipts")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .order("desc")
        .collect();
      if (branchId) {
        receipts = receipts.filter((r) => r.branchId === branchId);
      }
    } else if (branchId) {
      receipts = await ctx.db
        .query("receipts")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .order("desc")
        .collect();
    } else {
      receipts = await ctx.db
        .query("receipts")
        .withIndex("by_createdAt")
        .order("desc")
        .collect();
    }

    return receipts;
  },
});

/**
 * Get a single receipt by ID.
 */
export const get = query({
  args: { receiptId: v.id("receipts") },
  handler: async (ctx, args) => {
    // Receipts carry the planholder's name and amounts — staff only.
    await assertStaff(ctx);
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt) return null;

    const client = await ctx.db.get(receipt.clientId);
    const payment = await ctx.db.get(receipt.paymentId);

    return { ...receipt, client, payment };
  },
});

/**
 * Get receipt by receipt number.
 */
export const getByNumber = query({
  args: { receiptNumber: v.string() },
  handler: async (ctx, args) => {
    // Receipt numbers are sequential and guessable, so this must not be public.
    await assertStaff(ctx);
    const results = await ctx.db
      .query("receipts")
      .withIndex("by_receiptNumber", (q) =>
        q.eq("receiptNumber", args.receiptNumber)
      )
      .collect();

    return results[0] ?? null;
  },
});
