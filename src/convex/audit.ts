import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Log an audit event.
 */
export const log = mutation({
  args: {
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("status_change")
    ),
    entityType: v.union(
      v.literal("client"),
      v.literal("contract"),
      v.literal("payment"),
      v.literal("receipt")
    ),
    entityId: v.string(),
    description: v.string(),
    oldValues: v.optional(v.any()),
    newValues: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    const userName = user?.name || user?.email || "Unknown";

    return await ctx.db.insert("audit_log", {
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      userId,
      userName,
      description: args.description,
      oldValues: args.oldValues,
      newValues: args.newValues,
      timestamp: Date.now(),
    });
  },
});

/**
 * List audit logs with optional filters.
 */
export const list = query({
  args: {
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    action: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let logs;

    if (args.entityType && args.entityId) {
      logs = await ctx.db
        .query("audit_log")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", args.entityType as any).eq("entityId", args.entityId!)
        )
        .order("desc")
        .take(args.limit || 50);
    } else if (args.action) {
      logs = await ctx.db
        .query("audit_log")
        .withIndex("by_action", (q) => q.eq("action", args.action as any))
        .order("desc")
        .take(args.limit || 50);
    } else {
      logs = await ctx.db
        .query("audit_log")
        .withIndex("by_timestamp")
        .order("desc")
        .take(args.limit || 50);
    }

    return logs;
  },
});

/**
 * Get audit trail for a specific entity.
 */
export const getEntityTrail = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("audit_log")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType as any).eq("entityId", args.entityId)
      )
      .order("desc")
      .collect();
  },
});
