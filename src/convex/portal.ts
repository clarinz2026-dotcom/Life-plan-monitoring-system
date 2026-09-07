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
    contactEmail: v.optional(v.string()),
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
      contactEmail: args.contactEmail?.trim() || undefined,
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

/**
 * ─── Staff-facing endpoints ────────────────────────────────────────────────
 */

type StaffEnrichedRequest = Doc<"service_requests"> & {
  branch: RequestBranch | null;
  userEmail: string | null;
  userName: string | null;
};

/**
 * List all service requests (staff view), newest first.
 * Optional `status` filter.
 */
export const staffListRequests = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("submitted"),
        v.literal("under_review"),
        v.literal("scheduled"),
        v.literal("completed"),
        v.literal("cancelled"),
      )
    ),
  },
  handler: async (ctx, args): Promise<StaffEnrichedRequest[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let requests: Doc<"service_requests">[];
    if (args.status) {
      requests = await ctx.db
        .query("service_requests")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    } else {
      requests = await ctx.db
        .query("service_requests")
        .withIndex("by_createdAt")
        .order("desc")
        .collect();
    }

    const enriched: StaffEnrichedRequest[] = [];
    for (const r of requests) {
      const branch = r.branchId ? await ctx.db.get(r.branchId) : null;
      const reqUser = await ctx.db.get(r.userId);
      enriched.push({
        ...r,
        branch: branch
          ? {
              name: branch.name,
              city: branch.city,
              province: branch.province,
              address: branch.address,
              contactNumber: branch.contactNumber ?? null,
            }
          : null,
        userEmail: reqUser?.email ?? null,
        userName: reqUser?.name ?? null,
      });
    }
    return enriched;
  },
});

/**
 * Approve or decline a service request (staff action).
 * Sets status to `under_review` (approve) or `cancelled` (decline).
 * Optionally sets staffNotes.
 */
export const staffResolveRequest = mutation({
  args: {
    requestId: v.id("service_requests"),
    action: v.union(v.literal("approve"), v.literal("decline")),
    staffNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found.");
    if (request.status !== "submitted" && request.status !== "under_review") {
      throw new Error("This request has already been resolved.");
    }

    const newStatus = args.action === "approve" ? "under_review" : "cancelled";
    const updates: { status: typeof newStatus; staffNotes?: string } = { status: newStatus };
    if (args.staffNotes) updates.staffNotes = args.staffNotes.trim();

    await ctx.db.patch(args.requestId, updates);

    // Notify the requesting client
    const label = request.serviceType.replace(/_/g, " ");
    const actionWord = args.action === "approve" ? "approved" : "declined";
    await ctx.db.insert("notifications", {
      userId: request.userId,
      type: "system",
      title: `Request ${actionWord}: ${label}`,
      message:
        args.action === "approve"
          ? `Your ${label} request has been approved. Our staff will contact you shortly.`
          : `Your ${label} request has been declined.${args.staffNotes ? ` Reason: ${args.staffNotes}` : ""}`,
      channel: "in_app",
      status: "pending",
      scheduledAt: Date.now(),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Progress a request forward: under_review → scheduled → completed.
 */
export const staffProgressRequest = mutation({
  args: {
    requestId: v.id("service_requests"),
    action: v.union(v.literal("schedule"), v.literal("complete")),
    staffNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found.");

    let newStatus: "scheduled" | "completed";
    if (args.action === "schedule") {
      if (request.status !== "under_review") {
        throw new Error("Only approved requests can be scheduled.");
      }
      newStatus = "scheduled";
    } else {
      if (request.status !== "scheduled") {
        throw new Error("Only scheduled requests can be marked as completed.");
      }
      newStatus = "completed";
    }

    const updates: { status: typeof newStatus; staffNotes?: string } = { status: newStatus };
    if (args.staffNotes) updates.staffNotes = args.staffNotes.trim();
    await ctx.db.patch(args.requestId, updates);

    const label = request.serviceType.replace(/_/g, " ");
    const actionWord = args.action === "schedule" ? "scheduled" : "completed";
    await ctx.db.insert("notifications", {
      userId: request.userId,
      type: "system",
      title: `Request ${actionWord}: ${label}`,
      message:
        args.action === "schedule"
          ? `Your ${label} request has been scheduled. Our staff will contact you with the details.`
          : `Your ${label} request has been completed. Thank you for choosing Evangelist Funeral Services.`,
      channel: "in_app",
      status: "pending",
      scheduledAt: Date.now(),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Link a portal user to a client record (account linking).
 * Updates the client's email to match the requesting user's auth email,
 * marks the request as completed, and notifies the client.
 */
export const staffLinkAccount = mutation({
  args: {
    requestId: v.id("service_requests"),
    clientId: v.id("clients"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found.");
    if (request.serviceType !== "account_link") {
      throw new Error("This request is not an account linking request.");
    }

    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client record not found.");

    // Get the requesting user's auth email
    const requestUser = await ctx.db.get(request.userId);
    const userEmail = (requestUser?.email ?? "").trim().toLowerCase();
    if (!userEmail) {
      throw new Error("The requesting user has no email on their auth account.");
    }

    // Update the client record's email to match the user's auth email
    await ctx.db.patch(args.clientId, { email: userEmail });

    // Mark the request as completed
    await ctx.db.patch(args.requestId, {
      status: "completed",
      staffNotes: `Account linked: ${client.firstName} ${client.lastName} (${client.contactNumber}) → ${userEmail}`,
    });

    // Notify the requesting client
    await ctx.db.insert("notifications", {
      userId: request.userId,
      type: "system",
      title: "Account linked successfully",
      message: `Your account has been linked to ${client.firstName} ${client.lastName}'s plan records. Refresh your portal to see your plans and payments.`,
      channel: "in_app",
      status: "pending",
      scheduledAt: Date.now(),
      createdAt: Date.now(),
    });

    return { success: true, clientName: `${client.firstName} ${client.lastName}` };
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
