import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveBranchFilter } from "./access";
import {
  MS_PER_DAY,
  manilaDayOfMonth,
  manilaDayStart,
  manilaDaysInMonth,
  manilaMonthLabel,
  manilaMonthStart,
  manilaMonthStartOffset,
  manilaYearStart,
} from "./datetime";

/**
 * Collection summary by date range, optionally filtered by branch.
 */
export const collectionSummary = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    // All windows are Manila windows — the deployment's clock is UTC, so a
    // report read at 7am Manila would otherwise still be showing yesterday.
    const today = manilaDayStart();
    const weekAgo = today - 7 * MS_PER_DAY;
    const monthStart = manilaMonthStart();
    const lastMonthStart = manilaMonthStartOffset(-1);
    const yearStart = manilaYearStart();

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

    // Today (Manila), with an exclusive upper bound so tomorrow's date-stamped
    // rows can never be pulled into today's total.
    const todayEnd = today + MS_PER_DAY;
    const todayPayments = payments.filter(
      (p) => p.paymentDate >= today && p.paymentDate < todayEnd
    );
    const todayAmount = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    // This week
    const weekPayments = payments.filter((p) => p.paymentDate >= weekAgo);
    const weekAmount = weekPayments.reduce((sum, p) => sum + p.amount, 0);

    // This month
    const monthPayments = payments.filter((p) => p.paymentDate >= monthStart);
    const monthAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    // Last month (exclusive upper bound so the final day is fully counted)
    const lastMonthEndExclusive = monthStart;
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
    const monthStart = manilaMonthStart();

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
    const monthStart = manilaMonthStart();
    const daysInMonth = manilaDaysInMonth();

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
      // Manila day buckets, so a payment taken at 7am lands on the day the
      // collector actually received it.
      const dayStart = manilaDayOfMonth(d);
      const dayEnd = manilaDayOfMonth(d + 1);
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
    const months: Array<{ month: string; amount: number; count: number }> = [];

    // Only the last 12 Manila months are needed (index range), not the whole
    // table. Month boundaries are Manila midnights so a year-to-date figure
    // never disagrees with the branch dashboard.
    const trendStart = manilaMonthStartOffset(-11);
    let allPayments = await ctx.db
      .query("payments")
      .withIndex("by_paymentDate", (q) => q.gte("paymentDate", trendStart))
      .collect();
    if (branchId) {
      allPayments = allPayments.filter((p) => p.branchId === branchId);
    }

    for (let i = 11; i >= 0; i--) {
      const monthStart = manilaMonthStartOffset(-i);
      // Exclusive upper bound — the old value stopped at 00:00 of the last day,
      // silently dropping that day's later payments.
      const monthEnd = manilaMonthStartOffset(-i + 1);

      const monthPayments = allPayments.filter(
        (p) => p.paymentDate >= monthStart && p.paymentDate < monthEnd
      );

      months.push({
        month: manilaMonthLabel(monthStart),
        amount: monthPayments.reduce((sum, p) => sum + p.amount, 0),
        count: monthPayments.length,
      });
    }

    return months;
  },
});