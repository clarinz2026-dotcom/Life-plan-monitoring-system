import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getViewer, isAdminRole } from "./access";

/**
 * Log one per-recipient SMS result. Called from the send action (sms.ts) via
 * api.smsLog.log so every recipient's outcome is recorded even if a later
 * send throws.
 */
export const log = mutation({
  args: {
    to: v.string(),
    recipientName: v.optional(v.string()),
    recipientType: v.union(v.literal("client"), v.literal("staff")),
    clientId: v.optional(v.id("clients")),
    staffUserId: v.optional(v.id("users")),
    body: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    providerSid: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    await ctx.db.insert("sms_messages", {
      to: args.to,
      recipientName: args.recipientName,
      recipientType: args.recipientType,
      clientId: args.clientId,
      staffUserId: args.staffUserId,
      body: args.body,
      status: args.status,
      providerSid: args.providerSid,
      errorMessage: args.errorMessage,
      branchId: user?.branchId,
      sentBy: userId,
      createdAt: Date.now(),
    });
  },
});

/**
 * The caller's role — read by the send action (which runs on the Node runtime
 * and has no direct db access) to authorize the send.
 */
export const viewerRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const viewer = await getViewer(ctx);
    return viewer ? { role: viewer.role } : null;
  },
});

/** Recent outbound SMS history, newest first. Head Office sees all branches. */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const viewer = await getViewer(ctx);
    if (!viewer) return [];
    if (!isAdminRole(viewer.role) && viewer.role !== "manager") return [];

    const limit = Math.min(args.limit ?? 100, 300);
    const rows = await ctx.db
      .query("sms_messages")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);

    // Branch staff see only their branch's traffic; Head Office sees all.
    if (isAdminRole(viewer.role)) return rows;
    return rows.filter((r) => r.branchId !== undefined && r.branchId === viewer.branchId);
  },
});
