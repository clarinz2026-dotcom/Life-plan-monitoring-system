import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { resolveBranchFilter } from "./access";
import { effectiveRole } from "./roles";

/**
 * Portal access model:
 * - A portal user is an auth account (email OTP or guest).
 * - Client/planholder records are matched to the signed-in account by email,
 *   case-insensitively. Staff should record the planholder's email exactly as
 *   they use it to sign in.
 * - When the emails don't line up, the planholder can file an *account linking*
 *   request here and staff approve it, which sets the client's email to the
 *   requester's email.
 */

type RequestBranch = {
  name: string;
  city: string;
  province: string;
  address: string;
  contactNumber: string | null;
};

type EnrichedLinkRequest = Doc<"service_requests"> & {
  branch: RequestBranch | null;
  userEmail: string | null;
  userName: string | null;
};

type ContractDetail = {
  contract: Doc<"contracts">;
  payments: Doc<"payments">[];
  schedules: Doc<"payment_schedules">[];
  receipts: Doc<"receipts">[];
  /** Resolved sales agent display name (from users table). */
  salesAgentName: string | null;
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
  /** The caller's own account-linking requests, newest first. */
  linkRequests: Doc<"service_requests">[];
};

/** The only request type the portal still accepts. */
const ACCOUNT_LINK = "account_link";

const STAFF_ROLES = ["super_admin", "ceo", "manager"] as const;

/**
 * Require the current user to be staff (super_admin, ceo, or manager).
 * Returns the user doc on success, throws on failure.
 */
async function requireStaff(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated.");
  const user = await ctx.db.get(userId);
  if (
    !user ||
    !STAFF_ROLES.includes(effectiveRole(user) as typeof STAFF_ROLES[number])
  ) {
    throw new Error("Not authorized — staff access required.");
  }
  return user;
}

async function toRequestBranch(
  ctx: QueryCtx,
  branchId: Id<"branches"> | undefined
): Promise<RequestBranch | null> {
  if (!branchId) return null;
  const branch = await ctx.db.get(branchId);
  if (!branch) return null;
  return {
    name: branch.name,
    city: branch.city,
    province: branch.province,
    address: branch.address,
    contactNumber: branch.contactNumber ?? null,
  };
}

/**
 * Full overview of the signed-in client account: every matched planholder
 * record with its contracts, payments, schedules, and receipts — plus the
 * status of any account-linking requests they filed.
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

      // Batch-resolve all sales agent names (one read per unique agent).
      const agentIds = Array.from(
        new Set(allContracts.map((c) => c.assignedAgent).filter(Boolean))
      );
      const agentDocs = await Promise.all(agentIds.map((id) => ctx.db.get(id!)));
      const agentById = new Map(
        agentIds.map((id, i) => [id!, agentDocs[i]] as const)
      );

      for (const client of matched.values()) {
        const contracts = allContracts.filter((c) => c.clientId === client._id);
        const clientPayments = paymentsByClient.get(client._id) ?? [];
        const contractDetails: ContractDetail[] = contracts.map((contract) => {
          const agent = contract.assignedAgent
            ? agentById.get(contract.assignedAgent)
            : null;
          return {
            contract,
            payments: clientPayments
              .filter((p) => p.contractId === contract._id)
              .sort((a, b) => b.paymentDate - a.paymentDate),
            schedules: (schedulesByContract.get(contract._id) ?? []).sort(
              (a, b) => a.dueDate - b.dueDate
            ),
            receipts: (receiptsByContract.get(contract._id) ?? []).sort(
              (a, b) => b.createdAt - a.createdAt
            ),
            salesAgentName: agent?.name ?? agent?.email ?? null,
          };
        });

        records.push({ client, contracts: contractDetails });
      }
    }

    const allRequests = await ctx.db
      .query("service_requests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return {
      email: userEmail || null,
      isAnonymous: user.isAnonymous ?? false,
      name: user.name ?? null,
      records,
      linkRequests: allRequests.filter((r) => r.serviceType === ACCOUNT_LINK),
    };
  },
});

/**
 * File an account-linking request: "this portal account belongs to planholder
 * X". Staff approve it on the Account Linking page, which points the client
 * record's email at this auth account.
 */
export const requestAccountLink = mutation({
  args: {
    branchId: v.optional(v.id("branches")),
    contactName: v.string(),
    contactNumber: v.string(),
    contactEmail: v.optional(v.string()),
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

    // One open request at a time — otherwise staff see duplicates to review.
    const existing = await ctx.db
      .query("service_requests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const alreadyOpen = existing.find(
      (r) =>
        r.serviceType === ACCOUNT_LINK &&
        (r.status === "submitted" || r.status === "under_review")
    );
    if (alreadyOpen) {
      throw new Error(
        "You already have an account-linking request being reviewed. We'll notify you once it's processed."
      );
    }

    await ctx.db.insert("service_requests", {
      userId,
      serviceType: ACCOUNT_LINK,
      branchId: args.branchId,
      contactName,
      contactNumber,
      contactEmail: args.contactEmail?.trim() || undefined,
      message: args.message?.trim() || undefined,
      status: "submitted",
      createdAt: Date.now(),
    });

    const branch = await toRequestBranch(ctx, args.branchId);
    const where = branch ? ` (preferred branch: ${branch.name}, ${branch.city})` : "";
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
          title: "New account linking request",
          message: `${contactName} (${contactNumber}) asked to link their portal account${where}.`,
          channel: "in_app",
          status: "pending",
          scheduledAt: now,
          createdAt: now,
        });
      }
    }

    return { success: true };
  },
});

/** The caller's own account-linking requests, newest first. */
export const myLinkRequests = query({
  args: {},
  handler: async (ctx): Promise<Doc<"service_requests">[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const requests = await ctx.db
      .query("service_requests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return requests.filter((r) => r.serviceType === ACCOUNT_LINK);
  },
});

/** Cancel your own account-linking request while it is still being reviewed. */
export const cancelMyLinkRequest = mutation({
  args: { requestId: v.id("service_requests") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Please sign in first.");

    const request = await ctx.db.get(args.requestId);
    if (
      !request ||
      request.userId !== userId ||
      request.serviceType !== ACCOUNT_LINK
    ) {
      throw new Error("Request not found.");
    }
    if (request.status !== "submitted" && request.status !== "under_review") {
      throw new Error("This request can no longer be cancelled.");
    }

    await ctx.db.patch(args.requestId, { status: "cancelled" });
    return { success: true };
  },
});

/**
 * ─── Staff-facing account-linking queue ──────────────────────────────────────
 */

/** Account-linking requests (staff view), newest first. Optional status filter. */
export const staffListLinkRequests = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("submitted"),
        v.literal("under_review"),
        v.literal("completed"),
        v.literal("cancelled"),
      )
    ),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args): Promise<EnrichedLinkRequest[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (
      !user ||
      !STAFF_ROLES.includes(effectiveRole(user) as typeof STAFF_ROLES[number])
    )
      return [];

    const branchId = await resolveBranchFilter(ctx, args.branchId);

    let requests = await ctx.db
      .query("service_requests")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    requests = requests.filter((r) => r.serviceType === ACCOUNT_LINK);
    if (branchId) {
      // Branch staff only see requests for their own branch (and unassigned ones).
      requests = requests.filter(
        (r) => !r.branchId || r.branchId === branchId
      );
    }
    if (args.status) {
      requests = requests.filter((r) => r.status === args.status);
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
    if (request.serviceType !== ACCOUNT_LINK) {
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

/** Decline an account-linking request (staff action). */
export const staffDeclineLinkRequest = mutation({
  args: {
    requestId: v.id("service_requests"),
    staffNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found.");
    if (request.serviceType !== ACCOUNT_LINK) {
      throw new Error("This request is not an account linking request.");
    }
    if (request.status === "completed") {
      throw new Error("This request has already been linked.");
    }

    await ctx.db.patch(args.requestId, {
      status: "cancelled",
      ...(args.staffNotes ? { staffNotes: args.staffNotes.trim() } : {}),
    });

    await ctx.db.insert("notifications", {
      userId: request.userId,
      type: "system",
      title: "Account linking request declined",
      message: `We could not link your account to a plan record.${
        args.staffNotes ? ` Reason: ${args.staffNotes}` : ""
      } Please visit any branch with a valid ID so we can verify your records.`,
      channel: "in_app",
      status: "pending",
      scheduledAt: Date.now(),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});
