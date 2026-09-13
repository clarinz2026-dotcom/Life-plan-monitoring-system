import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { assertStaff } from "./access";

/**
 * Data layer for the Airtable integration.
 *
 * Everything here is an INTERNAL function: it can only be reached from other
 * Convex functions (the Airtable actions), never from a browser. Each one
 * re-checks that the caller is office staff and applies the caller's branch
 * scope, so a branch user can only ever push their own branch.
 *
 * Field names below are the Airtable column names the sync writes into.
 */

/** One Airtable record: a flat bag of fields keyed by column name. */
export type AirtableRecord = { fields: Record<string, string | number> };

export type AirtablePayload = {
  records: AirtableRecord[];
  /** Records available for the caller's branch (before the per-run limit). */
  total: number;
  /** True when the limit cut the payload short — run the sync again for more. */
  truncated: boolean;
};

/** Per-run cap. Airtable batches are 10 records, so 500 is ~50 requests. */
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

function clampLimit(limit?: number): number {
  if (!limit || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

/**
 * Build the field bag, dropping blanks. Airtable rejects `null` and empty
 * strings on typed columns (numbers, dates, email), so empty values are simply
 * omitted and the cell stays blank.
 */
function bag(
  entries: Record<string, string | number | null | undefined>
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

/** ISO string for a timestamp, or undefined when it is missing/invalid. */
function iso(ms?: number | null): string | undefined {
  if (!ms) return undefined;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** "First Middle Last" — the shape that reads best in a spreadsheet. */
function fullName(c: Doc<"clients">): string {
  return `${c.firstName}${c.middleName ? ` ${c.middleName}` : ""} ${c.lastName}`;
}

async function branchNameMap(
  ctx: QueryCtx,
  ids: Array<Id<"branches"> | undefined | null>
): Promise<Map<Id<"branches">, string>> {
  const unique = Array.from(
    new Set(ids.filter((id): id is Id<"branches"> => Boolean(id)))
  );
  const docs = await Promise.all(unique.map((id) => ctx.db.get(id)));
  return new Map(
    unique.map((id, i) => [id, docs[i]?.name ?? ""] as const)
  );
}

/**
 * Who is calling. Used by the actions to confirm staff access (actions have no
 * `ctx.db`, so the check has to happen in a query).
 */
export const whoAmI = internalQuery({
  args: {},
  handler: async (ctx) => {
    const viewer = await assertStaff(ctx);
    const user = await ctx.db.get(viewer.userId);
    return {
      name: user?.name ?? user?.email ?? "Unknown",
      role: viewer.role ?? "none",
      branchId: viewer.branchId ?? null,
    };
  },
});

/** Planholders, newest first. */
export const clients = internalQuery({
  args: {
    branchId: v.optional(v.id("branches")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AirtablePayload> => {
    const viewer = await assertStaff(ctx);
    const branchId = viewer.branchId ?? undefined;
    void args.branchId; // branch scope always comes from the caller's profile

    const rows = branchId
      ? await ctx.db
          .query("clients")
          .withIndex("by_branch", (q) => q.eq("branchId", branchId))
          .order("desc")
          .collect()
      : await ctx.db
          .query("clients")
          .withIndex("by_createdAt")
          .order("desc")
          .collect();

    const limit = clampLimit(args.limit);
    const page = rows.slice(0, limit);
    const branchNames = await branchNameMap(
      ctx,
      page.map((c) => c.branchId)
    );

    return {
      records: page.map((c) => ({
        fields: bag({
          "EFS ID": c._id,
          "Full Name": fullName(c),
          "Last Name": c.lastName,
          "First Name": c.firstName,
          "Middle Name": c.middleName,
          "Branch": c.branchId ? branchNames.get(c.branchId) : "",
          "Birth Date": iso(c.dateOfBirth),
          "Gender": c.gender,
          "Contact Number": c.contactNumber,
          "Email": c.email,
          "Address": c.address,
          "City": c.city,
          "Province": c.province,
          "ZIP Code": c.zipCode,
          "Occupation": c.occupation,
          "Beneficiary": c.beneficiaryName,
          "Beneficiary Relationship": c.beneficiaryRelationship,
          "Beneficiary Contact": c.beneficiaryContact,
          "Notes": c.notes,
          "Created At": iso(c.createdAt),
        }),
      })),
      total: rows.length,
      truncated: rows.length > page.length,
    };
  },
});

/** Memorial plans / contracts, newest first, with the planholder's name. */
export const contracts = internalQuery({
  args: {
    branchId: v.optional(v.id("branches")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AirtablePayload> => {
    const viewer = await assertStaff(ctx);
    const branchId = viewer.branchId ?? undefined;
    void args.branchId;

    const rows = branchId
      ? await ctx.db
          .query("contracts")
          .withIndex("by_branch", (q) => q.eq("branchId", branchId))
          .order("desc")
          .collect()
      : await ctx.db.query("contracts").order("desc").collect();

    const limit = clampLimit(args.limit);
    const page = rows.slice(0, limit);

    const clientIds = Array.from(new Set(page.map((c) => c.clientId)));
    const clientDocs = await Promise.all(clientIds.map((id) => ctx.db.get(id)));
    const clientById = new Map(
      clientIds.map((id, i) => [id, clientDocs[i]] as const)
    );
    const branchNames = await branchNameMap(ctx, [
      ...page.map((c) => c.branchId),
      ...clientDocs.map((c) => c?.branchId),
    ]);

    return {
      records: page.map((c) => {
        const client = clientById.get(c.clientId);
        return {
          fields: bag({
            "EFS ID": c._id,
            "Contract No.": c.contractNumber,
            "Planholder": client ? fullName(client) : "",
            "Planholder EFS ID": client?._id,
            "Branch": c.branchId
              ? branchNames.get(c.branchId)
              : client?.branchId
                ? branchNames.get(client.branchId)
                : "",
            "Plan Type": c.planType,
            "Plan Amount": c.planAmount,
            "Monthly Amortization": c.monthlyAmortization,
            "Total Paid": c.totalPaid,
            "Balance": c.planAmount - c.totalPaid,
            "Status": c.contractStatus,
            "Start Date": iso(c.startDate),
            "Maturity Date": iso(c.maturityDate),
            "Created At": iso(c.createdAt),
          }),
        };
      }),
      total: rows.length,
      truncated: rows.length > page.length,
    };
  },
});

/** Payments, most recent payment date first, with contract + planholder. */
export const payments = internalQuery({
  args: {
    branchId: v.optional(v.id("branches")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AirtablePayload> => {
    const viewer = await assertStaff(ctx);
    const branchId = viewer.branchId ?? undefined;
    void args.branchId;

    const all = branchId
      ? await ctx.db
          .query("payments")
          .withIndex("by_branch", (q) => q.eq("branchId", branchId))
          .collect()
      : await ctx.db.query("payments").collect();

    // Sort by payment date (not insertion order) so the newest money is first.
    all.sort((a, b) => b.paymentDate - a.paymentDate);

    const limit = clampLimit(args.limit);
    const page = all.slice(0, limit);

    const contractIds = Array.from(new Set(page.map((p) => p.contractId)));
    const contractDocs = await Promise.all(
      contractIds.map((id) => ctx.db.get(id))
    );
    const contractById = new Map(
      contractIds.map((id, i) => [id, contractDocs[i]] as const)
    );

    const clientIds = Array.from(
      new Set([
        ...page.map((p) => p.clientId),
        ...contractDocs.flatMap((c) => (c ? [c.clientId] : [])),
      ])
    );
    const clientDocs = await Promise.all(clientIds.map((id) => ctx.db.get(id)));
    const clientById = new Map(
      clientIds.map((id, i) => [id, clientDocs[i]] as const)
    );

    const userIds = Array.from(new Set(page.map((p) => p.recordedBy)));
    const userDocs = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userById = new Map(userIds.map((id, i) => [id, userDocs[i]] as const));

    const branchNames = await branchNameMap(ctx, [
      ...page.map((p) => p.branchId),
      ...contractDocs.map((c) => c?.branchId),
    ]);

    return {
      records: page.map((p) => {
        const contract = contractById.get(p.contractId);
        const client = clientById.get(p.clientId);
        const recorder = userById.get(p.recordedBy);
        return {
          fields: bag({
            "EFS ID": p._id,
            "Payment Date": iso(p.paymentDate),
            "Contract No.": contract?.contractNumber,
            "Planholder": client ? fullName(client) : "",
            "Planholder EFS ID": client?._id,
            "Branch": p.branchId
              ? branchNames.get(p.branchId)
              : contract?.branchId
                ? branchNames.get(contract.branchId)
                : "",
            "Amount": p.amount,
            "Channel": p.paymentChannel,
            "O.R. No.": p.orNumber,
            "Reference No.": p.referenceNumber,
            "Recorded By": recorder?.name ?? recorder?.email,
            "Remarks": p.remarks,
            "Recorded At": iso(p.createdAt),
          }),
        };
      }),
      total: all.length,
      truncated: all.length > page.length,
    };
  },
});

/** Record a completed sync in the audit trail. */
export const logSync = internalMutation({
  args: {
    summary: v.string(),
    details: v.any(),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    const user = await ctx.db.get(viewer.userId);
    await ctx.db.insert("audit_log", {
      action: "create",
      // Reused as a generic system event, matching the existing convention.
      entityType: "client",
      entityId: "airtable-sync",
      userId: viewer.userId,
      userName: user?.name ?? user?.email ?? "Unknown",
      description: args.summary,
      newValues: args.details,
      timestamp: Date.now(),
    });
  },
});
