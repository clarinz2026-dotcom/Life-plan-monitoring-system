import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveBranchFilter } from "./access";

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

const STAFF_ROLES = ["super_admin", "ceo", "manager"] as const;

/**
 * Require the current user to be staff (super_admin, ceo, or manager).
 * Returns the user doc on success, throws on failure.
 */
async function requireStaff(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated.");
  const user = await ctx.db.get(userId);
  if (!user || !STAFF_ROLES.includes(user.role as typeof STAFF_ROLES[number])) {
    throw new Error("Not authorized — staff access required.");
  }
  return user;
}

/** Notify office staff (super admin / ceo / manager) of a new client request. */
async function notifyOffice(
  ctx: MutationCtx,
  title: string,
  message: string
) {
  const now = Date.now();
  for (const role of STAFF_ROLES) {
    const staff = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", role))
      .collect();
    for (const u of staff) {
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

      const clientIds = Array.from(matched.values()).map((c) => c._id);

      // Batch-fetch all related data across all matched clients (avoid N+1)
      const allContracts: Doc<"contracts">[] = [];
      const allPayments: Doc<"payments">[] = [];
      const allSchedules: Doc<"payment_schedules">[] = [];
      const allReceipts: Doc<"receipts">[] = [];
      for (const cid of clientIds) {
        allContracts.push(
          ...(await ctx.db
            .query("contracts")
            .withIndex("by_client", (q) => q.eq("clientId", cid))
            .collect())
        );
        allPayments.push(
          ...(await ctx.db
            .query("payments")
            .withIndex("by_client", (q) => q.eq("clientId", cid))
            .collect())
        );
        allSchedules.push(
          ...(await ctx.db
            .query("payment_schedules")
            .withIndex("by_client", (q) => q.eq("clientId", cid))
            .collect())
        );
        allReceipts.push(
          ...(await ctx.db
            .query("receipts")
            .withIndex("by_client", (q) => q.eq("clientId", cid))
            .collect())
        );
      }

      // Build lookup maps for fast filtering
      const paymentsByClient = new Map<string, Doc<"payments">[]>();
      for (const p of allPayments) {
        const list = paymentsByClient.get(p.clientId) ?? [];
        list.push(p);
        paymentsByClient.set(p.clientId, list);
      }
      const schedulesByContract = new Map<string, Doc<"payment_schedules">[]>();
      for (const s of allSchedules) {
        const list = schedulesByContract.get(s.contractId) ?? [];
        list.push(s);
        schedulesByContract.set(s.contractId, list);
      }
      const receiptsByContract = new Map<string, Doc<"receipts">[]>();
      for (const r of allReceipts) {
        const list = receiptsByContract.get(r.contractId) ?? [];
        list.push(r);
        receiptsByContract.set(r.contractId, list);
      }

      for (const client of matched.values()) {
        const contracts = allContracts.filter((c) => c.clientId === client._id);
        const clientPayments = paymentsByClient.get(client._id) ?? [];
        const contractDetails: ContractDetail[] = contracts.map((contract) => ({
          contract,
          payments: clientPayments
            .filter((p) => p.contractId === contract._id)
            .sort((a, b) => b.paymentDate - a.paymentDate),
          schedules: (schedulesByContract.get(contract._id) ?? [])
            .sort((a, b) => a.dueDate - b.dueDate),
          receipts: (receiptsByContract.get(contract._id) ?? [])
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
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args): Promise<StaffEnrichedRequest[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user || !STAFF_ROLES.includes(user.role as typeof STAFF_ROLES[number])) return [];

    const branchId = await resolveBranchFilter(ctx, args.branchId);

    let requests: Doc<"service_requests">[];
    if (branchId) {
      // Branch staff read only their own branch's requests (indexed).
      requests = await ctx.db
        .query("service_requests")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId))
        .order("desc")
        .collect();
      if (args.status) requests = requests.filter((r) => r.status === args.status);
    } else if (args.status) {
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

    // Batch the lookups so we do one read per branch / per requesting user
    // instead of two reads for every row.
    const branchIds = Array.from(
      new Set(requests.map((r) => r.branchId).filter(Boolean))
    ) as Array<Id<"branches">>;
    const userIds = Array.from(new Set(requests.map((r) => r.userId)));
    const [branchDocs, userDocs] = await Promise.all([
      Promise.all(branchIds.map((id) => ctx.db.get(id))),
      Promise.all(userIds.map((id) => ctx.db.get(id))),
    ]);
    const branchById = new Map(
      branchIds.map((id, i) => [id, branchDocs[i]] as const)
    );
    const userById = new Map(userIds.map((id, i) => [id, userDocs[i]] as const));

    return requests.map((r) => {
      const branch = r.branchId ? branchById.get(r.branchId) ?? null : null;
      const reqUser = userById.get(r.userId) ?? null;
      return {
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
      };
    });
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
    await requireStaff(ctx);

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
    await requireStaff(ctx);

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
    await requireStaff(ctx);

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

    // Uniqueness guard: check if another client already has this email
    const existingClients = await ctx.db
      .query("clients")
      .withIndex("by_email", (q) => q.eq("email", userEmail))
      .collect();
    const conflict = existingClients.find((c) => c._id !== args.clientId);
    if (conflict) {
      throw new Error(
        `This email is already linked to ${conflict.firstName} ${conflict.lastName}. Unlink that record first or use a different email.`
      );
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
