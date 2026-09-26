import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanAccessRecord, assertStaff } from "./access";

/**
 * Generate payment schedules for a contract (monthly installments).
 */
export const generateForContract = mutation({
  args: {
    contractId: v.id("contracts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");
    await assertCanAccessRecord(ctx, contract.branchId);

    // Check if schedules already exist
    const existing = await ctx.db
      .query("payment_schedules")
      .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
      .collect();

    if (existing.length > 0) return { created: 0 };

    const startDate = new Date(contract.startDate);
    const monthlyAmount = contract.monthlyAmortization;
    let created = 0;

    // Calculate number of months
    const totalMonths = Math.ceil(contract.planAmount / monthlyAmount);

    /*
     * Installments fall due on the same day of the month as the plan's
     * effectivity date, one month apart — a plan effective Aug 22 has its
     * first installment due Sep 22, the second Oct 22, and so on. The day is
     * clamped to the end of the target month, so a plan effective on the 31st
     * lands on the 28th/29th in February instead of spilling into March.
     *
     * This mirrors `installmentDueDate` in src/components/SOADocument.tsx,
     * which is what the printed statement and the staff/portal pages show.
     */
    const startDay = startDate.getDate();

    for (let i = 0; i < totalMonths; i++) {
      const monthIndex = startDate.getMonth() + (i + 1);
      const year = startDate.getFullYear() + Math.floor(monthIndex / 12);
      const month = ((monthIndex % 12) + 12) % 12;
      // Day 0 of the following month is the last day of the target month.
      const lastDay = new Date(year, month + 1, 0).getDate();
      const dueDate = new Date(year, month, Math.min(startDay, lastDay));

      await ctx.db.insert("payment_schedules", {
        contractId: args.contractId,
        clientId: contract.clientId,
        dueDate: dueDate.getTime(),
        amount: monthlyAmount,
        status: "pending",
        reminderSent: false,
        createdAt: Date.now(),
      });
      created++;
    }

    return { created };
  },
});

/**
 * Mark a schedule as paid.
 */
export const markPaid = mutation({
  args: {
    scheduleId: v.id("payment_schedules"),
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => {
    await assertStaff(ctx);

    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    // The payment must belong to the same contract as the schedule.
    const payment = await ctx.db.get(args.paymentId);
    if (!payment || payment.contractId !== schedule.contractId) {
      throw new Error("That payment does not belong to this contract.");
    }
    const contract = await ctx.db.get(schedule.contractId);
    await assertCanAccessRecord(ctx, contract?.branchId);

    await ctx.db.patch(args.scheduleId, {
      status: "paid",
      paidPaymentId: args.paymentId,
    });

    return { success: true };
  },
});

/**
 * List schedules for a contract.
 */
export const listByContract = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    await assertStaff(ctx);
    return await ctx.db
      .query("payment_schedules")
      .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
      .order("asc")
      .collect();
  },
});

/**
 * List overdue schedules (due date < now, status = pending).
 */
export const listOverdue = query({
  args: {},
  handler: async (ctx) => {
    await assertStaff(ctx);
    const now = Date.now();
    const allPending = await ctx.db
      .query("payment_schedules")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const overdue = allPending.filter((s) => s.dueDate < now);

    // Enrich with client/contract info
    const enriched = await Promise.all(
      overdue.map(async (s) => {
        const client = await ctx.db.get(s.clientId);
        const contract = await ctx.db.get(s.contractId);
        const daysOverdue = Math.floor((now - s.dueDate) / (1000 * 60 * 60 * 24));
        return { ...s, client, contract, daysOverdue };
      })
    );

    return enriched;
  },
});

/**
 * Mark overdue schedules (due date < now) as overdue.
 */
export const updateOverdueStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    await assertStaff(ctx);
    const now = Date.now();
    const allPending = await ctx.db
      .query("payment_schedules")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    let updated = 0;
    for (const schedule of allPending) {
      if (schedule.dueDate < now) {
        await ctx.db.patch(schedule._id, { status: "overdue" });
        updated++;
      }
    }

    return { updated };
  },
});

/**
 * Get upcoming due dates for a client.
 */
export const upcomingForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    await assertStaff(ctx);
    return await ctx.db
      .query("payment_schedules")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("asc")
      .collect();
  },
});
