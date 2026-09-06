import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Portal access model:
 * - A portal user is an auth account (email OTP or guest).
 * - Client/planholder records are matched to the signed-in account by email,
 *   case-insensitively. Staff should record the planholder's email exactly as
 *   they use it to sign in.
 * - Signed-out/first-time users can still use the portal to request services;
 *   they simply see no account records until the emails line up.
 */

type RequestBranch = {
  name: string;
  city: string;
  province: string;
  address: string;
  contactNumber: string | null;
};

type EnrichedRequest = Doc<"service_requests"> & {
  branch: RequestBranch | null;
};

type ContractDetail = {
  contract: Doc<"contracts">;
  payments: Doc<"payments">[];
  schedules: Doc<"payment_schedules">[];
  receipts: Doc<"receipts">[];
};

type RecordGroup = {
  client: Doc<"clients">;
  contracts: ContractDetail[];
};

type PortalOverview = {
  email: string | null;
  isAnonymous: boolean;
  name: string | null;
  records: RecordGroup[];
  requests: EnrichedRequest[];
};

async function enrichRequest(
  ctx: QueryCtx,
  req: Doc<"service_requests">
): Promise<EnrichedRequest> {
  const branch = req.branchId ? await ctx.db.get(req.branchId) : null;
  return {
    ...req,
    branch: branch
      ? {
          name: branch.name,
          city: branch.city,
          province: branch.province,
          address: branch.address,
          contactNumber: branch.contactNumber ?? null,
        }
      : null,
  };
}

/** Notify office staff (super admin / ceo / manager) of a new client request. */
async function notifyOffice(
  ctx: MutationCtx,
  title: string,
  message: string
) {
  const now = Date.now();
  const users = await ctx.db.query("users").collect();
  for (const u of users) {
    if (u.role === "super_admin" || u.role === "ceo" || u.role === "manager") {
      await ctx.db.insert("notifications", {
        userId: u._id,
        type: "system",
        title,
        message,
        channel: "in_app",
        status: "pending",
        scheduledAt: now,
        createdAt: now,
      });
    }
  }
}

/**
 * Full overview of the signed-in client account: every matched planholder
 * record with its contracts, payments, schedules, and receipts.
 */
export const myOverview = query({
  args: {},
  handler: async (ctx): Promise<PortalOverview | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const userEmail = (user.email ?? "").trim();
    const emailLower = userEmail.toLowerCase();
    const records: RecordGroup[] = [];

    if (emailLower) {
      // Try the most likely spellings so staff-entered emails match cleanly.
      const candidates = Array.from(
        new Set([emailLower, userEmail, emailLower.toUpperCase()])
      );
      const matched = new Map<string, Doc<"clients">>();
      for (const candidate of candidates) {
        const hits = await ctx.db
          .query("clients")
          .withIndex("by_email", (q) => q.eq("email", candidate))
          .collect();
        for (const hit of hits) matched.set(hit._id, hit);
        if (matched.size > 0) break;
      }

      for (const client of matched.values()) {
        const contracts = await ctx.db
          .query("contracts")
          .withIndex("by_client", (q) => q.eq("clientId", client._id))
          .collect();
        const payments = await ctx.db
          .query("payments")
          .withIndex("by_client", (q) => q.eq("clientId", client._id))
          .collect();
        const schedules = await ctx.db
          .query("payment_schedules")
          .withIndex("by_client", (q) => q.eq("clientId", client._id))
          .collect();
        const receipts = await ctx.db
          .query("receipts")
          .withIndex("by_client", (q) => q.eq("clientId", client._id))
          .collect();

        const contractIds = new Set(contracts.map((c) => c._id));
        const contractDetails: ContractDetail[] = contracts.map((contract) => ({
          contract,
          payments: payments
            .filter((p) => p.contractId === contract._id)
            .sort((a, b) => b.paymentDate - a.paymentDate),
          schedules: schedules
            .filter((s) => s.contractId === contract._id)
            .sort((a, b) => a.dueDate - b.dueDate),
          receipts: receipts
            .filter((r) => contractIds.has(r.contractId))
            .sort((a, b) => b.createdAt - a.createdAt),
        }));

        records.push({ client, contracts: contractDetails });
      }
    }

    const requests = await ctx.db
      .query("service_requests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return {
      email: userEmail || null,
      isAnonymous: user.isAnonymous ?? false,
      name: user.name ?? null,
      records,
      requests: await Promise.all(requests.map((r) => enrichRequest(ctx, r))),
    };
  },
});

/** The signed-in user's service requests (newest first). */
export const myRequests = query({
  args: {},
  handler: async (ctx): Promise<EnrichedRequest[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const requests = await ctx.db
      .query("service_requests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return Promise.all(requests.map((r) => enrichRequest(ctx, r)));
  },
});

/** Submit a service request for any of the company's offerings. */
export const submitRequest = mutation({
  args: {
    serviceType: v.string(),
    branchId: v.optional(v.id("branches")),
    contactName: v.string(),
    contactNumber: v.string(),
    preferredDate: v.optional(v.number()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Please sign in first.");

    const contactName = args.contactName.trim();
    const contactNumber = args.contactNumber.trim();
    if (!contactName || !contactNumber) {
      throw new Error("Contact name and number are required.");
    }

    await ctx.db.insert("service_requests", {
      userId,
      serviceType: args.serviceType,
      branchId: args.branchId,
      contactName,
      contactNumber,
      preferredDate: args.preferredDate,
      message: args.message?.trim() || undefined,
      status: "submitted",
      createdAt: Date.now(),
    });

    const branch = args.branchId ? await ctx.db.get(args.branchId) : null;
    const serviceLabel = args.serviceType.replace(/_/g, " ");
    const where = branch ? ` at ${branch.name}, ${branch.city}` : "";
    const when = args.preferredDate
      ? ` Preferred date: ${new Date(args.preferredDate).toLocaleDateString("en-PH")}.`
      : "";
    await notifyOffice(
      ctx,
      `New portal request — ${serviceLabel}`,
      `${contactName} (${contactNumber}) requested ${serviceLabel}${where}.${when}${
        args.message ? ` Note: ${args.message}` : ""
      }`
    );

    return { success: true };
  },
});

/** Cancel one of your own requests while it is still being reviewed. */
export const cancelMyRequest = mutation({
  args: { requestId: v.id("service_requests") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Please sign in first.");

    const request = await ctx.db.get(args.requestId);
    if (!request || request.userId !== userId) {
      throw new Error("Request not found.");
    }
    if (request.status !== "submitted" && request.status !== "under_review") {
      throw new Error("This request can no longer be cancelled.");
    }

    await ctx.db.patch(args.requestId, { status: "cancelled" });
    return { success: true };
  },
});
