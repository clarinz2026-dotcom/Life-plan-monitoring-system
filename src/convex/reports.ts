import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveBranchFilter } from "./access";

/**
 * Collection summary by date range, optionally filtered by branch.
 */
export const collectionSummary = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

    // Everything this query reports lives at or after the earliest window
    // (this year, or last month when we are in January), so read only that
    // slice through the date index instead of scanning the payments table.
    const rangeStart = Math.min(yearStart, lastMonthStart);
    let payments = await ctx.db
      .query("payments")
      .withIndex("by_paymentDate", (q) => q.gte("paymentDate", rangeStart))
      .collect();
    if (branchId) {
      payments = payments.filter((p) => p.branchId === branchId);
    }

    // Today
    const todayPayments = payments.filter((p) => p.paymentDate >= today);
    const todayAmount = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    // This week
    const weekPayments = payments.filter((p) => p.paymentDate >= weekAgo);
    const weekAmount = weekPayments.reduce((sum, p) => sum + p.amount, 0);

    // This month
    const monthPayments = payments.filter((p) => p.paymentDate >= monthStart);
    const monthAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    // Last month (exclusive upper bound so the final day is fully counted)
    const lastMonthEndExclusive = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).getTime();
    const lastMonthPayments = payments.filter(
      (p) =>
        p.paymentDate >= lastMonthStart && p.paymentDate < lastMonthEndExclusive
    );
    const lastMonthAmount = lastMonthPayments.reduce((sum, p) => sum + p.amount, 0);

    // Year to date
    const yearPayments = payments.filter((p) => p.paymentDate >= yearStart);
    const yearAmount = yearPayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      today: { count: todayPayments.length, amount: todayAmount },
      thisWeek: { count: weekPayments.length, amount: weekAmount },
      thisMonth: { count: monthPayments.length, amount: monthAmount },
      lastMonth: { count: lastMonthPayments.length, amount: lastMonthAmount },
      yearToDate: { count: yearPayments.length, amount: yearAmount },
    };
  },
});

/**
 * Collections by payment channel, optionally filtered by branch.
 */
export const byChannel = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    // Read only this month's payments through the date index instead of
    // scanning the whole payments table on every report load.
    let payments = await ctx.db
      .query("payments")
      .withIndex("by_paymentDate", (q) => q.gte("paymentDate", monthStart))
      .collect();
    if (branchId) {
      payments = payments.filter((p) => p.branchId === branchId);
    }
    const monthPayments = payments;

    const channels: Record<string, { count: number; amount: number }> = {};

    for (const p of monthPayments) {
      const ch = p.paymentChannel;
      if (!channels[ch]) channels[ch] = { count: 0, amount: 0 };
      channels[ch].count++;
      channels[ch].amount += p.amount;
    }

    return channels;
  },
});

/**
 * Collections by cashier/user, optionally filtered by branch.
 */
export const byCashier = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    // Read only this month's payments through the date index instead of
    // scanning the whole payments table on every report load.
    let payments = await ctx.db
      .query("payments")
      .withIndex("by_paymentDate", (q) => q.gte("paymentDate", monthStart))
      .collect();
    if (branchId) {
      payments = payments.filter((p) => p.branchId === branchId);
    }
    const monthPayments = payments;

    const cashiers: Record<string, { count: number; amount: number; name: string }> = {};

    for (const p of monthPayments) {
      const userId = p.recordedBy;
      if (!cashiers[userId]) {
        const user = await ctx.db.get(userId);
        cashiers[userId] = {
          count: 0,
          amount: 0,
          name: user?.name || user?.email || "Unknown",
        };
      }
      cashiers[userId].count++;
      cashiers[userId].amount += p.amount;
    }

    return cashiers;
  },
});

/**
 * Daily collections for the current month (for chart), optionally filtered by branch.
 */
export const dailyCollections = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthStart = new Date(year, month, 1).getTime();

    // Read only this month's payments through the date index instead of
    // scanning the whole payments table on every report load.
    let payments = await ctx.db
      .query("payments")
      .withIndex("by_paymentDate", (q) => q.gte("paymentDate", monthStart))
      .collect();
    if (branchId) {
      payments = payments.filter((p) => p.branchId === branchId);
    }
    const monthPayments = payments;

    const daily: Array<{ day: number; amount: number; count: number }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStart = new Date(year, month, d).getTime();
      const dayEnd = new Date(year, month, d + 1).getTime();
      const dayPayments = monthPayments.filter(
        (p) => p.paymentDate >= dayStart && p.paymentDate < dayEnd
      );
      daily.push({
        day: d,
        amount: dayPayments.reduce((sum, p) => sum + p.amount, 0),
        count: dayPayments.length,
      });
    }

    return daily;
  },
});

/**
 * Outstanding receivables aging report, optionally filtered by branch.
 */
export const agingReport = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const contracts = branchId
      ? await ctx.db
          .query("contracts")
          .withIndex("by_branch", (q) => q.eq("branchId", branchId))
          .collect()
      : await ctx.db.query("contracts").collect();

    const aging = {
      current: { count: 0, amount: 0 },
      "30_days": { count: 0, amount: 0 },
      "60_days": { count: 0, amount: 0 },
      "90_days": { count: 0, amount: 0 },
      lapsed: { count: 0, amount: 0 },
      fully_paid: { count: 0, amount: 0 },
    };

    for (const c of contracts) {
      const balance = c.planAmount - c.totalPaid;

      switch (c.contractStatus) {
        case "current":
          aging.current.count++;
          aging.current.amount += balance;
          break;
        case "delinquent_30":
          aging["30_days"].count++;
          aging["30_days"].amount += balance;
          break;
        case "delinquent_60":
          aging["60_days"].count++;
          aging["60_days"].amount += balance;
          break;
        case "delinquent_90":
          aging["90_days"].count++;
          aging["90_days"].amount += balance;
          break;
        case "lapsed":
          aging.lapsed.count++;
          aging.lapsed.amount += balance;
          break;
        case "fully_paid":
          aging.fully_paid.count++;
          break;
      }
    }

    return aging;
  },
});

/**
 * Monthly collections trend (last 12 months), optionally filtered by branch.
 */
export const monthlyTrend = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const now = new Date();
    const months: Array<{ month: string; amount: number; count: number }> = [];

    // Only the last 12 months are needed (index range), not the whole table.
    const trendStart = new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1
    ).getTime();
    let allPayments = await ctx.db
      .query("payments")
      .withIndex("by_paymentDate", (q) => q.gte("paymentDate", trendStart))
      .collect();
    if (branchId) {
      allPayments = allPayments.filter((p) => p.branchId === branchId);
    }

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = d.getTime();
      // Exclusive upper bound — the old value stopped at 00:00 of the last day,
      // silently dropping that day's later payments.
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();

      const monthPayments = allPayments.filter(
        (p) => p.paymentDate >= monthStart && p.paymentDate < monthEnd
      );

      months.push({
        month: d.toLocaleDateString("en-PH", { year: "numeric", month: "short" }),
        amount: monthPayments.reduce((sum, p) => sum + p.amount, 0),
        count: monthPayments.length,
      });
    }

    return months;
  },
});