import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertStaff, isAdminRole, resolveBranchFilter } from "./access";
import type { Id } from "./_generated/dataModel";

/**
 * Audit trail scoping.
 *
 * The trail is evidence, so it is append-only for everyone and readable only
 * by office staff. Branch staff see entries for their own branch (plus rows
 * written before branching existed, which carry no branch — those must remain
 * visible or a branch would lose its own history). Head Office sees every
 * branch, optionally narrowed to one.
 */
function scopeLogs<T extends { branchId?: Id<"branches"> }>(
  logs: T[],
  viewerBranchId: Id<"branches"> | null | undefined,
  isAdmin: boolean
): T[] {
  if (isAdmin) return logs;
  return logs.filter((l) => !l.branchId || l.branchId === viewerBranchId);
}

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
      v.literal("receipt"),
      v.literal("or_series"),
      v.literal("lpa_series"),
      v.literal("collector_target"),
      v.literal("api_key")
    ),
    entityId: v.string(),
    description: v.string(),
    oldValues: v.optional(v.any()),
    newValues: v.optional(v.any()),
    /** Branch the action belongs to. Ignored for branch staff, who are always
     *  stamped with their own branch. */
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Audit entries are evidence — only staff may append to the trail, so a
    // planholder account cannot forge entries attributed to other users.
    const viewer = await assertStaff(ctx);

    const user = await ctx.db.get(userId);
    const userName = user?.name || user?.email || "Unknown";

    // The authenticated account decides the branch, never the submitted value.
    const branchId = isAdminRole(viewer.role)
      ? args.branchId ?? viewer.branchId ?? undefined
      : viewer.branchId ?? undefined;

    return await ctx.db.insert("audit_log", {
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      userId,
      userName,
      description: args.description,
      oldValues: args.oldValues,
      newValues: args.newValues,
      branchId,
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
    /** Head Office branch filter. Branch staff are forced to their own. */
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    const isAdmin = isAdminRole(viewer.role);
    // Head Office may narrow the trail to one branch; branch staff are always
    // narrowed to their own.
    const branchId = isAdmin
      ? await resolveBranchFilter(ctx, args.branchId)
      : viewer.branchId ?? undefined;

    const limit = args.limit || 50;
    // Branch filtering happens after the indexed read, so read a wider slice
    // first — otherwise a busy company-wide trail could filter down to fewer
    // than `limit` rows for a branch that is quiet.
    const readCount = isAdmin && !branchId ? limit : limit * 3;

    let logs;

    if (args.entityType && args.entityId) {
      logs = await ctx.db
        .query("audit_log")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", args.entityType as any).eq("entityId", args.entityId!)
        )
        .order("desc")
        .take(readCount);
    } else if (args.action) {
      logs = await ctx.db
        .query("audit_log")
        .withIndex("by_action", (q) => q.eq("action", args.action as any))
        .order("desc")
        .take(readCount);
    } else {
      logs = await ctx.db
        .query("audit_log")
        .withIndex("by_timestamp")
        .order("desc")
        .take(readCount);
    }

    if (isAdmin && branchId) {
      logs = logs.filter((l) => l.branchId === branchId);
    }

    return scopeLogs(logs, viewer.branchId, isAdmin).slice(0, limit);
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
    const viewer = await assertStaff(ctx);

    const logs = await ctx.db
      .query("audit_log")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType as any).eq("entityId", args.entityId)
      )
      .order("desc")
      .collect();

    return scopeLogs(logs, viewer.branchId, isAdminRole(viewer.role));
  },
});
