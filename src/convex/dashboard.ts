import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveBranchFilter } from "./access";
import {
  MS_PER_DAY,
  lastManilaDays,
  manilaDayStart,
  manilaMonthStart,
  manilaWeekdayLabel,
} from "./datetime";

/**
 * Dashboard summary stats — optionally filtered by branchId.
 * Pass branchId: undefined or skip for "all branches" view.
 */
export const summary = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);

    // ── Clients ──
    let clients;
    if (branchId) {
      clients = await ctx.db
        .query("clients")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .collect();
    } else {
      clients = await ctx.db.query("clients").collect();
    }
    const totalClients = clients.length;

    // Manila boundaries, not the server's (UTC) clock. "This month" and
    // "today" must match the days the branches actually operate on.
    const monthStart = manilaMonthStart();
    const newClientsThisMonth = clients.filter(
      (c) => c.createdAt >= monthStart
    ).length;

    // ── Contracts ──
    let contracts;
    if (branchId) {
      contracts = await ctx.db
        .query("contracts")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .collect();
    } else {
      contracts = await ctx.db.query("contracts").collect();
    }
    const contractsByStatus: Record<string, number> = {};
    let totalContractValue = 0;
    let totalCollected = 0;
    let fullyPaidCount = 0;

    for (const c of contracts) {
      contractsByStatus[c.contractStatus] =
        (contractsByStatus[c.contractStatus] || 0) + 1;
      totalContractValue += c.planAmount;
      totalCollected += c.totalPaid;
      if (c.contractStatus === "fully_paid") fullyPaidCount++;
    }

    const collectionRate =
      totalContractValue > 0
        ? Math.min(Math.round((totalCollected / totalContractValue) * 100), 100)
        : 0;

    // ── Payments ──
    let payments;
    if (branchId) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .collect();
    } else {
      payments = await ctx.db.query("payments").collect();
    }
    const totalPayments = payments.length;
    const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    // Manila day boundary — previously this was the server's local midnight,
    // which is 08:00 in the Philippines, so early-morning collections were
    // attributed to the previous day and disagreed with the cashier's
    // reconciliation sheet.
    const todayStart = manilaDayStart();
    const tomorrowStart = todayStart + MS_PER_DAY;
    const todayPayments = payments.filter(
      (p) => p.paymentDate >= todayStart && p.paymentDate < tomorrowStart
    );
    const todayAmount = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    const monthPayments = payments.filter((p) => p.paymentDate >= monthStart);
    const monthAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    const yesterdayStart = todayStart - MS_PER_DAY;
    const yesterdayAmount = payments
      .filter((p) => p.paymentDate >= yesterdayStart && p.paymentDate < todayStart)
      .reduce((sum, p) => sum + p.amount, 0);

    const byChannel: Record<string, { amount: number; count: number }> = {};
    for (const p of monthPayments) {
      const ch = p.paymentChannel;
      byChannel[ch] = byChannel[ch] || { amount: 0, count: 0 };
      byChannel[ch].amount += p.amount;
      byChannel[ch].count += 1;
    }

    return {
      totalClients,
      newClientsThisMonth,
      totalContracts: contracts.length,
      contractsByStatus,
      totalContractValue,
      totalCollected,
      collectionRate,
      fullyPaidCount,
      totalPayments,
      totalPaymentAmount,
      todayPayments: todayPayments.length,
      todayAmount,
      yesterdayAmount,
      monthPayments: monthPayments.length,
      monthAmount,
      byChannel,
    };
  },
});

/**
 * Collections for the last 7 days — optionally filtered by branch.
 */
export const weeklyTrend = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);

    // Only the last 7 Manila days matter — read that slice through the date
    // index instead of scanning every payment ever recorded.
    const dayStarts = lastManilaDays(7);

    let payments = await ctx.db
      .query("payments")
      .withIndex("by_paymentDate", (q) => q.gte("paymentDate", dayStarts[0]))
      .collect();
    if (branchId) {
      payments = payments.filter((p) => p.branchId === branchId);
    }

    return dayStarts.map((dayStart) => {
      const dayEnd = dayStart + MS_PER_DAY;
      const dayPayments = payments.filter(
        (p) => p.paymentDate >= dayStart && p.paymentDate < dayEnd
      );
      return {
        label: manilaWeekdayLabel(dayStart),
        amount: dayPayments.reduce((sum, p) => sum + p.amount, 0),
        count: dayPayments.length,
      };
    });
  },
});

/**
 * Recent payments — optionally filtered by branch.
 */
export const recentPayments = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    let payments;
    if (branchId) {
      payments = await ctx.db
        .query("payments")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .order("desc")
        .take(20);
    } else {
      payments = await ctx.db
        .query("payments")
        .order("desc")
        .take(20);
    }

    const enriched = await Promise.all(
      payments.map(async (p) => {
        const client = await ctx.db.get(p.clientId);
        const contract = await ctx.db.get(p.contractId);
        return { ...p, client, contract };
      })
    );

    return enriched;
  },
});

/**
 * Delinquent contracts — optionally filtered by branch.
 */
export const delinquentContracts = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const statuses = [
      "delinquent_30",
      "delinquent_60",
      "delinquent_90",
      "lapsed",
    ] as const;

    const results = [];
    for (const status of statuses) {
      // Branch view uses the compound [branchId, contractStatus] index so we
      // never read other branches' contracts.
      const contracts = branchId
        ? await ctx.db
            .query("contracts")
            .withIndex("by_branch_status", (q) =>
              q.eq("branchId", branchId).eq("contractStatus", status)
            )
            .collect()
        : await ctx.db
            .query("contracts")
            .withIndex("by_status", (q) => q.eq("contractStatus", status))
            .collect();

      for (const c of contracts) {
        const client = await ctx.db.get(c.clientId);
        results.push({ ...c, client });
      }
    }

    const severity: Record<string, number> = {
      lapsed: 4,
      delinquent_90: 3,
      delinquent_60: 2,
      delinquent_30: 1,
    };
    results.sort(
      (a, b) => (severity[b.contractStatus] ?? 0) - (severity[a.contractStatus] ?? 0)
    );

    return results;
  },
});
