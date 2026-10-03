import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { GenericActionCtx, GenericDataModel } from "convex/server";

/** Every status a request can be in — used to narrow the filter argument. */
const REQUEST_STATUSES = [
  "submitted",
  "in_progress",
  "completed",
  "refused",
] as const;

/**
 * The endpoint only ever calls one thing on its context, so it asks for that
 * one thing. That keeps it directly registrable on the router without casting
 * a full action context down to a narrower one.
 */
type SubmitCtx = Pick<GenericActionCtx<GenericDataModel>, "runMutation">;

import { assertStaff, isAdminRole } from "./access";
import { sha256Hex } from "../lib/apiKeys";
import {
  isRequestKind,
  requestKindLabel,
  validateRequest,
  type RequestDraft,
} from "../lib/legal";

/**
 * Data subject requests — "delete my data", "show me what you hold", "correct
 * this", and "stop messaging me".
 *
 * The intake endpoint is PUBLIC (a planholder asking to be forgotten cannot be
 * asked to sign in first), so it is deliberately the smallest possible surface:
 *
 *   - it is an httpAction, not a mutation, so it is not callable from the
 *     client SDK at all and cannot be spammed from a script;
 *   - it only forwards to an *internal* mutation, so the write cannot be
 *     reached except through this endpoint;
 *   - the internal mutation re-validates everything with the same
 *     `validateRequest` the browser used, so a hand-crafted POST is filtered
 *     by exactly the same rules;
 *   - submissions are rate-limited per hashed IP address per hour.
 *
 * Nothing here deletes anything on its own. A request is a request: staff act
 * on it from the Privacy Requests page and record what they did, and the
 * fulfilment is written to the audit log.
 */

/** Submissions allowed from one address in one hour. */
export const MAX_REQUESTS_PER_HOUR = 5;

const HOUR_MS = 60 * 60 * 1000;

/** Stable, non-reversible handle for a submitter: hash of IP + hour bucket. */
function submitterKey(ip: string, now: number): string {
  const bucket = Math.floor(now / HOUR_MS);
  return `${sha256Hex(ip)}:${bucket}`;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * POST /privacy-request
 *
 * Body: `{ kind, name, email, contactNumber?, planNumber?, branch?, details? }`
 * Returns `{ ok: true, reference }` or `{ ok: false, error }` with a 4xx.
 */
export const submitRequest = async (
  ctx: SubmitCtx,
  request: Request
): Promise<Response> => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: Partial<RequestDraft>;
  try {
    body = (await request.json()) as Partial<RequestDraft>;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "We could not read that request." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const draft: RequestDraft = {
    kind: String(body.kind ?? ""),
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    contactNumber: body.contactNumber ? String(body.contactNumber) : "",
    planNumber: body.planNumber ? String(body.planNumber) : "",
    branch: body.branch ? String(body.branch) : "",
    details: body.details ? String(body.details) : "",
  };

  const issues = validateRequest(draft);
  if (issues.length > 0) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: issues[0].message,
        issues,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const now = Date.now();
  const result = await ctx.runMutation(internal.privacy.recordSubmission, {
    draft: {
      kind: draft.kind,
      name: draft.name,
      email: draft.email,
      contactNumber: draft.contactNumber ?? "",
      planNumber: draft.planNumber ?? "",
      branch: draft.branch ?? "",
      details: draft.details ?? "",
    },
    submitterKey: submitterKey(clientIp(request), now),
    now,
  });

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 429,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * The only write path into `privacy_requests`. Internal: reachable solely from
 * the endpoint above.
 */
export const recordSubmission = internalMutation({
  args: {
    draft: v.object({
      kind: v.string(),
      name: v.string(),
      email: v.string(),
      contactNumber: v.string(),
      planNumber: v.string(),
      branch: v.string(),
      details: v.string(),
    }),
    submitterKey: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    // Re-checked here, not just in the action: an internal mutation is the
    // boundary the database actually sees.
    const issues = validateRequest(args.draft);
    if (issues.length > 0) {
      return { ok: false as const, error: issues[0].message };
    }
    if (!isRequestKind(args.draft.kind)) {
      return { ok: false as const, error: "Unknown request type." };
    }

    // Fixed-window rate limit, keyed by hashed IP + hour. The raw address is
    // never stored.
    const key = args.submitterKey;
    const existing = await ctx.db
      .query("privacy_request_limits")
      .withIndex("by_updatedAt", (q) => q.lte("updatedAt", args.now))
      .collect();
    const current = existing.find((row) => row.key === key);

    if (current && current.count >= MAX_REQUESTS_PER_HOUR) {
      return {
        ok: false as const,
        error:
          "We have already received several requests from this connection. Please call the office instead.",
      };
    }

    if (current) {
      await ctx.db.patch(current._id, {
        count: current.count + 1,
        updatedAt: args.now,
      });
    } else {
      await ctx.db.insert("privacy_request_limits", {
        key,
        count: 1,
        updatedAt: args.now,
      });
    }

    // Drop counters older than a day so the table cannot grow without bound.
    const stale = existing.filter(
      (row) => row.key !== key && row.updatedAt < args.now - 24 * HOUR_MS
    );
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }

    const id = await ctx.db.insert("privacy_requests", {
      kind: args.draft.kind as "delete" | "access" | "correct" | "stop_messages",
      name: args.draft.name.trim(),
      email: args.draft.email.trim(),
      contactNumber: args.draft.contactNumber.trim() || undefined,
      planNumber: args.draft.planNumber.trim() || undefined,
      branch: args.draft.branch.trim() || undefined,
      details: args.draft.details.trim() || undefined,
      status: "submitted",
      submitterHash: key,
      submittedAt: args.now,
    });

    // Short reference the person can quote on the phone. Not a lookup secret —
    // the office still has to confirm who they are before acting.
    const reference = `PR-${new Date(args.now).getFullYear()}-${String(
      id.slice(-6)
    )}`;

    return { ok: true as const, reference };
  },
});

/**
 * The staff queue.
 *
 * Branch staff see requests routed to their branch (and un-routed ones, which
 * nobody has claimed yet); Head Office sees everything. This mirrors the audit
 * trail's scoping rule so a branch cannot read another branch's requesters.
 */
export const list = query({
  args: {
    status: v.optional(v.string()),
    /** Head Office branch filter; ignored for branch staff. */
    branchId: v.optional(v.id("branches")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    const isAdmin = isAdminRole(viewer.role);

    let rows;
    if (args.status && (REQUEST_STATUSES as readonly string[]).includes(args.status)) {
      rows = await ctx.db
        .query("privacy_requests")
        .withIndex("by_status", (q) =>
          q.eq("status", args.status as (typeof REQUEST_STATUSES)[number])
        )
        .order("desc")
        .take(200);
    } else {
      rows = await ctx.db
        .query("privacy_requests")
        .withIndex("by_submittedAt")
        .order("desc")
        .take(200);
    }

    const branchId = isAdmin ? args.branchId : viewer.branchId ?? undefined;

    return rows
      .filter((r) => (branchId ? !r.branchId || r.branchId === branchId : true))
      .slice(0, args.limit ?? 100);
  },
});

/** How many are waiting, for the nav badge. */
export const openCount = query({
  handler: async (ctx) => {
    await assertStaff(ctx);
    const submitted = await ctx.db
      .query("privacy_requests")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    const inProgress = await ctx.db
      .query("privacy_requests")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();
    return submitted.length + inProgress.length;
  },
});

/**
 * Act on a request: route it to a branch, mark it handled, and say what was
 * done. Every change is written to the audit log, because "we deleted it" is
 * exactly the kind of claim that has to be provable.
 */
export const updateRequest = mutation({
  args: {
    requestId: v.id("privacy_requests"),
    status: v.optional(
      v.union(
        v.literal("submitted"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("refused")
      )
    ),
    branchId: v.optional(v.id("branches")),
    clientId: v.optional(v.id("clients")),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("That request no longer exists.");

    // Branch staff may only work their own queue; Head Office may route one
    // anywhere. Same rule as every other record in the system.
    if (
      !isAdminRole(viewer.role) &&
      request.branchId &&
      viewer.branchId !== request.branchId
    ) {
      throw new Error("That request belongs to another branch.");
    }

    const patch: Record<string, unknown> = {};
    if (args.status) patch.status = args.status;
    if (args.branchId !== undefined) patch.branchId = args.branchId;
    if (args.clientId !== undefined) patch.clientId = args.clientId;
    if (args.resolution !== undefined) patch.resolution = args.resolution;
    if (args.status === "completed" || args.status === "refused") {
      patch.handledBy = viewer.userId;
      patch.handledAt = Date.now();
    }
    await ctx.db.patch(args.requestId, patch);

    const user = await ctx.db.get(viewer.userId);
    await ctx.db.insert("audit_log", {
      action: "update",
      entityType: "privacy_request",
      entityId: args.requestId,
      userId: viewer.userId,
      userName: user?.name || user?.email || "Unknown",
      description: `${requestKindLabel(request.kind)} request ${
        args.status ? `marked ${args.status}` : "updated"
      }${args.resolution ? `: ${args.resolution}` : ""}`,
      oldValues: { status: request.status, branchId: request.branchId },
      newValues: patch,
      branchId: request.branchId ?? viewer.branchId ?? undefined,
      timestamp: Date.now(),
    });

    return { ok: true };
  },
});