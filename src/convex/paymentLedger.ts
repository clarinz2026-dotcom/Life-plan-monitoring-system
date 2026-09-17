import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * How the payment ledger is read.
 *
 * Reversing a payment (see `payments.archive`) takes the amount back off the
 * plan and cancels its receipt, but the row stays in the table so the audit
 * trail survives and the entry can be restored. That means every figure derived
 * from payments — collections, the dashboard, reports, the cashier's
 * reconciliation, delinquency — has to skip reversed rows, or the same money
 * would be counted twice or counted after it was taken back.
 *
 * The rule lives here once instead of being repeated (and eventually
 * forgotten) at each call site.
 */

/** Drop reversed payments from a ledger read. */
export function liveOnly<T extends { archivedAt?: number }>(payments: T[]): T[] {
  return payments.filter((p) => !p.archivedAt);
}

/**
 * Most recent *live* payment date for a contract, or null when the plan has no
 * live payments left.
 *
 * The one-row index lookup is kept for the common case; only when the newest
 * row turns out to be a reversal does this walk the contract's history to find
 * the payment that actually counts as the last one.
 */
export async function lastLivePaymentDate(
  ctx: QueryCtx | MutationCtx,
  contractId: Id<"contracts">
): Promise<number | null> {
  const newest = await ctx.db
    .query("payments")
    .withIndex("by_contract_paymentDate", (q) => q.eq("contractId", contractId))
    .order("desc")
    .take(1);

  if (!newest[0]) return null;
  if (!newest[0].archivedAt) return newest[0].paymentDate;

  const history = await ctx.db
    .query("payments")
    .withIndex("by_contract", (q) => q.eq("contractId", contractId))
    .collect();

  return history
    .filter((p) => !p.archivedAt)
    .reduce<number | null>(
      (latest, p) => (latest === null || p.paymentDate > latest ? p.paymentDate : latest),
      null
    );
}
