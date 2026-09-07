import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanAccessRecord, resolveBranchFilter } from "./access";

const CLAIM_STATUSES = [
  "filed",
  "under_review",
  "documents_incomplete",
  "documents_complete",
  "approved",
  "rejected",
  "payout_pending",
  "payout_completed",
] as const;

/**
 * File a new death claim.
 */
export const fileClaim = mutation({
  args: {
    contractId: v.id("contracts"),
    clientId: v.id("clients"),
    claimantName: v.string(),
    claimantRelationship: v.string(),
    claimantContact: v.string(),
    claimantAddress: v.optional(v.string()),
    dateOfDeath: v.number(),
    deathCertificateNo: v.optional(v.string()),
    causeOfDeath: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");
    await assertCanAccessRecord(ctx, contract.branchId);

    // Required documents
    const documentsRequired = [
      "Death Certificate",
      "Claimant Valid ID",
      "Proof of Relationship",
      "Original Contract",
      "Notarized Affidavit of Loss (if original lost)",
    ];

    // Update contract status
    await ctx.db.patch(args.contractId, {
      contractStatus: "assigned_death_claim",
    });

    const claimId = await ctx.db.insert("death_claims", {
      contractId: args.contractId,
      clientId: args.clientId,
      claimantName: args.claimantName,
      claimantRelationship: args.claimantRelationship,
      claimantContact: args.claimantContact,
      claimantAddress: args.claimantAddress,
      dateOfDeath: args.dateOfDeath,
      deathCertificateNo: args.deathCertificateNo,
      causeOfDeath: args.causeOfDeath,
      documentsRequired,
      documentsSubmitted: [],
      status: "filed",
      payoutAmount: contract.planAmount - contract.totalPaid,
      processedBy: userId,
      notes: args.notes,
      filedBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Audit log
    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "contract",
      entityId: args.contractId,
      userId,
      description: `Death claim filed for contract ${contract.contractNumber}`,
      newValues: {
        claimantName: args.claimantName,
        payoutAmount: contract.planAmount - contract.totalPaid,
      },
      timestamp: Date.now(),
    });

    return { claimId };
  },
});

/**
 * Update claim status.
 */
export const updateStatus = mutation({
  args: {
    claimId: v.id("death_claims"),
    status: v.union(
      ...CLAIM_STATUSES.map((s) => v.literal(s)) as any
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    const claimContract = await ctx.db.get(claim.contractId);
    await assertCanAccessRecord(ctx, claimContract?.branchId ?? undefined);

    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.status === "approved" || args.status === "rejected") {
      patch.reviewedBy = userId;
    }

    if (args.notes) {
      patch.notes = args.notes;
    }

    await ctx.db.patch(args.claimId, patch);

    // If payout completed, update contract status
    if (args.status === "payout_completed") {
      patch.payoutDate = Date.now();
      await ctx.db.patch(args.claimId, { payoutDate: Date.now() });
    }

    // Audit log
    const contract = await ctx.db.get(claim.contractId);
    await ctx.db.insert("audit_log", {
      action: "status_change",
      entityType: "contract",
      entityId: claim.contractId,
      userId,
      description: `Death claim status changed to ${args.status} for ${contract?.contractNumber}`,
      oldValues: { status: claim.status },
      newValues: { status: args.status },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Submit documents for a claim.
 */
export const submitDocuments = mutation({
  args: {
    claimId: v.id("death_claims"),
    documents: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    const claimContract = await ctx.db.get(claim.contractId);
    await assertCanAccessRecord(ctx, claimContract?.branchId ?? undefined);

    const allSubmitted = [...new Set([...claim.documentsSubmitted, ...args.documents])];
    await ctx.db.patch(args.claimId, {
      documentsSubmitted: allSubmitted,
      updatedAt: Date.now(),
    });

    // Auto-update status if all docs submitted
    if (allSubmitted.length >= claim.documentsRequired.length) {
      await ctx.db.patch(args.claimId, {
        status: "documents_complete",
      });
    } else {
      await ctx.db.patch(args.claimId, {
        status: "documents_incomplete",
      });
    }

    return { success: true };
  },
});

/**
 * List death claims.
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(...CLAIM_STATUSES.map((s) => v.literal(s)) as any)
    ),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    let claims = await ctx.db.query("death_claims").order("desc").collect();

    if (args.status) {
      claims = claims.filter((c) => c.status === args.status);
    }

    // Filter by the branch of each claim's contract
    if (branchId) {
      const filtered = [];
      for (const c of claims) {
        const contract = await ctx.db.get(c.contractId);
        if (contract?.branchId === branchId) filtered.push(c);
      }
      claims = filtered;
    }

    const enriched = await Promise.all(
      claims.map(async (c) => {
        const client = await ctx.db.get(c.clientId);
        const contract = await ctx.db.get(c.contractId);
        const filedBy = await ctx.db.get(c.filedBy);
        return {
          ...c,
          clientName: client ? `${client.firstName} ${client.lastName}` : "Unknown",
          contractNumber: contract?.contractNumber || "Unknown",
          planType: contract?.planType || "Unknown",
          filedByName: filedBy?.name || filedBy?.email || "Unknown",
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single claim.
 */
export const get = query({
  args: { claimId: v.id("death_claims") },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return null;

    const client = await ctx.db.get(claim.clientId);
    const contract = await ctx.db.get(claim.contractId);
    const filedBy = await ctx.db.get(claim.filedBy);
    const reviewedBy = claim.reviewedBy ? await ctx.db.get(claim.reviewedBy) : null;

    return {
      ...claim,
      client,
      contract,
      filedByName: filedBy?.name || filedBy?.email || "Unknown",
      reviewedByName: reviewedBy?.name || reviewedBy?.email || null,
    };
  },
});
