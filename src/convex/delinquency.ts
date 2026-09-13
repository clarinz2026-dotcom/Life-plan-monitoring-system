import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { assertStaff, resolveBranchFilter } from "./access";

/** Roles allowed to trigger a global status recalculation. */
const STAFF_ROLES = [
  "super_admin",
  "ceo",
  "manager",
  "finance_staff",
  "cashier",
] as const;

/**
 * Calculate days since a given timestamp.
 */
function daysSince(timestamp: number): number {
  const now = Date.now();
  const diff = now - timestamp;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Determine contract status based on days since last payment.
 */
function computeStatus(daysSincePayment: number, isFullyPaid: boolean): string {
  if (isFullyPaid) return "fully_paid";
  if (daysSincePayment <= 30) return "current";
  if (daysSincePayment <= 60) return "delinquent_30";
  if (daysSincePayment <= 90) return "delinquent_60";
  if (daysSincePayment <= 120) return "delinquent_90";
  return "lapsed";
}

/**
 * Update all contract statuses based on payment history.
 * This is the main function to run as a cron job.
 */
export const updateAllContractStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Only staff may recalculate statuses. Without this, any signed-in client
    // portal account could rewrite every contract in the system.
    const viewer = await ctx.db.get(userId);
    if (
      !viewer ||
      !STAFF_ROLES.includes(viewer.role as (typeof STAFF_ROLES)[number])
    ) {
      throw new Error("Only staff can recalculate contract statuses.");
    }

    // Branch staff only recalculate their own branch (admins do all branches).
    const branchId = await resolveBranchFilter(ctx, undefined);
    const contracts = branchId
      ? await ctx.db
          .query("contracts")
          .withIndex("by_branch", (q) => q.eq("branchId", branchId))
          .collect()
      : await ctx.db.query("contracts").collect();
    const updated: Array<{ contractId: string; oldStatus: string; newStatus: string }> = [];

    for (const contract of contracts) {
      // Skip contracts that are already fully paid or death claim
      if (contract.contractStatus === "fully_paid" || contract.contractStatus === "assigned_death_claim") {
        continue;
      }

      // Latest payment only — one indexed row instead of the whole history.
      const latestPayment = await ctx.db
        .query("payments")
        .withIndex("by_contract_paymentDate", (q) =>
          q.eq("contractId", contract._id)
        )
        .order("desc")
        .take(1);

      // Determine reference date: last payment date or contract start date
      const referenceDate = latestPayment[0]?.paymentDate ?? contract.startDate;

      const days = daysSince(referenceDate);
      const isFullyPaid = contract.totalPaid >= contract.planAmount;
      const newStatus = computeStatus(days, isFullyPaid);

      // Only update if status changed
      if (newStatus !== contract.contractStatus) {
        const oldStatus = contract.contractStatus;
        await ctx.db.patch(contract._id, { contractStatus: newStatus as any });

        // Log the status change
        await ctx.db.insert("audit_log", {
          action: "status_change",
          entityType: "contract",
          entityId: contract._id,
          userId,
          userName: "System (Cron Job)",
          description: `Contract status updated from "${oldStatus}" to "${newStatus}" (${days} days since last payment)`,
          oldValues: { contractStatus: oldStatus },
          newValues: { contractStatus: newStatus, daysSincePayment: days },
          timestamp: Date.now(),
        });

        updated.push({
          contractId: contract._id,
          oldStatus,
          newStatus,
        });
      }
    }

    return {
      totalContracts: contracts.length,
      updated: updated.length,
      changes: updated,
    };
  },
});

/**
 * Get delinquency summary stats.
 */
export const summary = query({
  handler: async (ctx) => {
    // Business stats — not visible to non-staff callers.
    await assertStaff(ctx);
    const contracts = await ctx.db.query("contracts").collect();
    const statuses: Record<string, number> = {};

    for (const c of contracts) {
      statuses[c.contractStatus] = (statuses[c.contractStatus] || 0) + 1;
    }

    return {
      total: contracts.length,
      current: statuses["current"] || 0,
      delinquent_30: statuses["delinquent_30"] || 0,
      delinquent_60: statuses["delinquent_60"] || 0,
      delinquent_90: statuses["delinquent_90"] || 0,
      lapsed: statuses["lapsed"] || 0,
      fully_paid: statuses["fully_paid"] || 0,
      assigned_death_claim: statuses["assigned_death_claim"] || 0,
    };
  },
});
