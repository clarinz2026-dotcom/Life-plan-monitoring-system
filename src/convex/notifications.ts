import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertStaff } from "./access";

/**
 * Create a notification.
 */
export const create = mutation({
  args: {
    userId: v.id("users"),
    clientId: v.optional(v.id("clients")),
    type: v.union(
      v.literal("payment_reminder"),
      v.literal("delinquency_alert"),
      v.literal("claim_update"),
      v.literal("system"),
    ),
    title: v.string(),
    message: v.string(),
    channel: v.union(
      v.literal("sms"),
      v.literal("email"),
      v.literal("in_app"),
    ),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    await assertStaff(ctx);
    const notificationId = await ctx.db.insert("notifications", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });

    return { notificationId };
  },
});

/**
 * Mark a notification as sent.
 */
export const markSent = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await assertStaff(ctx);
    await ctx.db.patch(args.notificationId, {
      status: "sent",
      sentAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Mark a notification as read.
 */
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // You may only mark your own notifications as read.
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found.");
    }

    await ctx.db.patch(args.notificationId, {
      status: "read",
      readAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Mark all unread notifications for a user as read.
 */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const n of unread) {
      if (n.status === "pending" || n.status === "sent") {
        await ctx.db.patch(n._id, {
          status: "read",
          readAt: Date.now(),
        });
      }
    }

    return { updated: unread.length };
  },
});

/**
 * List notifications for a user.
 */
export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Get unread count for current user.
 */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return all.filter(
      (n) => n.status === "pending" || n.status === "sent"
    ).length;
  },
});

/**
 * Generate payment reminder notifications for overdue schedules.
 */
/**
 * How many schedules one run may process. Convex mutations have a bounded
 * transaction size, so a big back-log is cleared over successive runs instead
 * of failing the whole batch.
 */
const MAX_REMINDERS_PER_RUN = 200;

/**
 * Generate payment reminder notifications for overdue schedules.
 */
export const generateReminders = mutation({
  args: {},
  handler: async (ctx) => {
    await assertStaff(ctx);

    const now = Date.now();
    const weekFromNow = now + 7 * 86400000;

    // Get all pending schedules
    const pending = await ctx.db
      .query("payment_schedules")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    // Resolve the recipients once instead of re-reading the users table for
    // every schedule (was one full scan per schedule).
    const recipients: Array<{ _id: Id<"users"> }> = [];
    for (const role of ["ceo", "manager"] as const) {
      const staff = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", role))
        .collect();
      recipients.push(...staff);
    }

    let created = 0;
    let remaining = 0;

    for (const schedule of pending) {
      // Already sent reminder?
      if (schedule.reminderSent) continue;

      const daysUntilDue = Math.floor((schedule.dueDate - now) / 86400000);

      // Send reminder if due within 7 days or overdue
      if (schedule.dueDate > weekFromNow) continue;

      if (created >= MAX_REMINDERS_PER_RUN) {
        remaining++;
        continue;
      }

      const contract = await ctx.db.get(schedule.contractId);
      const client = await ctx.db.get(schedule.clientId);

      const isOverdue = schedule.dueDate < now;
      const title = isOverdue ? "Payment Overdue" : "Payment Due Soon";
      const message = isOverdue
        ? `Payment of ₱${schedule.amount.toLocaleString()} for ${client?.firstName} ${client?.lastName} (${contract?.contractNumber}) is ${Math.abs(daysUntilDue)} days overdue.`
        : `Payment of ₱${schedule.amount.toLocaleString()} for ${client?.firstName} ${client?.lastName} (${contract?.contractNumber}) is due in ${daysUntilDue} days.`;

      for (const user of recipients) {
        await ctx.db.insert("notifications", {
          userId: user._id,
          clientId: schedule.clientId,
          type: isOverdue ? "delinquency_alert" : "payment_reminder",
          title,
          message,
          channel: "in_app",
          status: "pending",
          scheduledAt: now,
          createdAt: now,
        });
      }

      // Mark reminder as sent
      await ctx.db.patch(schedule._id, { reminderSent: true });
      created++;
    }

    return { created, remaining, notified: recipients.length };
  },
});
