import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Read-only data endpoints backing the public REST API.
 *
 * These are `internalQuery` functions so they can only be called from the
 * http actions in http.ts (which authenticate the Bearer key first) — never
 * directly from a browser. Everything returned is shaped for external
 * consumption: flat JSON, ISO dates, human field names, and no internal ids
 * beyond the plan/contract number the office already uses on paper.
 */

function iso(t: number | undefined): string | null {
  return t ? new Date(t).toISOString() : null;
}

/**
 * Resolve a contract's outstanding balance the way the office does: plan
 * amount minus total paid, floored at zero. Lapsed plans keep their balance
 * visible so accounting can see what is still owed.
 */
function outstanding(planAmount: number, totalPaid: number): number {
  return Math.max(0, Math.round((planAmount - totalPaid) * 100) / 100);
}

function statusWord(status: string): string {
  // Delinquency buckets collapse into words a family would recognize; the
  // exact bucket stays available as `delinquencyBucket`.
  if (status === "current") return "Active";
  if (status === "lapsed") return "Forfeited";
  if (status === "fully_paid") return "Fully Paid";
  if (status.startsWith("delinquent_")) return "Active";
  return status;
}

function delinquencyBucket(status: string): string | null {
  if (status === "delinquent_30") return "30 days";
  if (status === "delinquent_60") return "60 days";
  if (status === "delinquent_90") return "90+ days";
  return null;
}

/** List planholders (most recently created first). */
export const listClients = internalQuery({
  args: {
    limit: v.number(),
    updatedSince: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const clients = await ctx.db.query("clients").collect();
    const filtered = args.updatedSince
      ? clients.filter((c) => c._creationTime >= args.updatedSince!)
      : clients;
    const sorted = filtered.sort(
      (a, b) => b._creationTime - a._creationTime
    );
    return sorted.slice(0, args.limit).map((c) => ({
      id: c._id,
      name: [c.lastName, c.firstName, c.middleName].filter(Boolean).join(", ")
        .replace(", " + "", "")
        .trim(),
      firstName: c.firstName,
      lastName: c.lastName,
      middleName: c.middleName ?? null,
      dateOfBirth: iso(c.dateOfBirth),
      gender: c.gender,
      contactNumber: c.contactNumber,
      email: c.email ?? null,
      address: c.address,
      city: c.city,
      province: c.province,
      beneficiaryName: c.beneficiaryName,
      beneficiaryRelationship: c.beneficiaryRelationship,
      beneficiaries: c.beneficiaries ?? [],
      archived: c.archivedAt != null,
      createdAt: iso(c._creationTime),
    }));
  },
});

/** Get one planholder with their plans summarized. */
export const getClient = internalQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.clientId);
    if (!c) return null;
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    return {
      id: c._id,
      firstName: c.firstName,
      lastName: c.lastName,
      middleName: c.middleName ?? null,
      dateOfBirth: iso(c.dateOfBirth),
      gender: c.gender,
      contactNumber: c.contactNumber,
      email: c.email ?? null,
      address: c.address,
      city: c.city,
      province: c.province,
      beneficiaryName: c.beneficiaryName,
      beneficiaryRelationship: c.beneficiaryRelationship,
      beneficiaries: c.beneficiaries ?? [],
      archived: c.archivedAt != null,
      createdAt: iso(c._creationTime),
      plans: contracts.map((k) => ({
        contractNumber: k.contractNumber,
        planType: k.planType,
        planAmount: k.planAmount,
        totalPaid: k.totalPaid,
        outstanding: outstanding(k.planAmount, k.totalPaid),
        status: statusWord(k.contractStatus),
        delinquencyBucket: delinquencyBucket(k.contractStatus),
        startDate: iso(k.startDate),
        maturityDate: iso(k.maturityDate ?? undefined),
      })),
    };
  },
});

/**
 * List contracts (plans), newest first, with the planholder's display name
 * resolved in the same query so integrations do not need a second call.
 */
export const listContracts = internalQuery({
  args: {
    limit: v.number(),
    updatedSince: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("current"),
        v.literal("delinquent_30"),
        v.literal("delinquent_60"),
        v.literal("delinquent_90"),
        v.literal("lapsed"),
        v.literal("fully_paid"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let rows;
    if (args.status) {
      rows = await ctx.db
        .query("contracts")
        .withIndex("by_status", (q) => q.eq("contractStatus", args.status!))
        .collect();
    } else {
      rows = await ctx.db.query("contracts").collect();
    }
    const filtered = args.updatedSince
      ? rows.filter((r) => r._creationTime >= args.updatedSince!)
      : rows;
    const sorted = filtered.sort((a, b) => b._creationTime - a._creationTime);

    return await Promise.all(
      sorted.slice(0, args.limit).map(async (k) => {
        const client = await ctx.db.get(k.clientId);
        const branch = k.branchId ? await ctx.db.get(k.branchId) : null;
        return {
          id: k._id,
          contractNumber: k.contractNumber,
          planholderName: client
            ? [client.lastName, client.firstName].filter(Boolean).join(", ")
            : "(deleted planholder)",
          planType: k.planType,
          planAmount: k.planAmount,
          monthlyAmortization: k.monthlyAmortization,
          totalPaid: k.totalPaid,
          outstanding: outstanding(k.planAmount, k.totalPaid),
          status: statusWord(k.contractStatus),
          delinquencyBucket: delinquencyBucket(k.contractStatus),
          startDate: iso(k.startDate),
          maturityDate: iso(k.maturityDate ?? undefined),
          branchName: branch?.name ?? null,
          createdAt: iso(k._creationTime),
        };
      })
    );
  },
});

/**
 * List payments, newest first, with planholder and O.R. details resolved.
 * Reversed (archived) payments are excluded — they never hit the ledger.
 */
export const listPayments = internalQuery({
  args: {
    limit: v.number(),
    updatedSince: v.optional(v.number()),
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    let rows;
    if (args.clientId) {
      rows = await ctx.db
        .query("payments")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .collect();
    } else {
      rows = await ctx.db.query("payments").collect();
    }
    const filtered = rows.filter(
      (p) =>
        p.archivedAt == null &&
        (!args.updatedSince || p._creationTime >= args.updatedSince!)
    );
    const sorted = filtered.sort((a, b) => b._creationTime - a._creationTime);

    return await Promise.all(
      sorted.slice(0, args.limit).map(async (p) => {
        const client = await ctx.db.get(p.clientId);
        const contract = await ctx.db.get(p.contractId);
        return {
          id: p._id,
          paymentDate: iso(p.paymentDate),
          amount: p.amount,
          channel: p.paymentChannel,
          orNumber: p.orNumber ?? null,
          referenceNumber: p.referenceNumber ?? null,
          chequeNumber: p.chequeNumber ?? null,
          bankName: p.bankName ?? null,
          remarks: p.remarks ?? null,
          planholderName: client
            ? [client.lastName, client.firstName].filter(Boolean).join(", ")
            : null,
          contractNumber: contract?.contractNumber ?? null,
          recordedAt: iso(p._creationTime),
        };
      })
    );
  },
});
