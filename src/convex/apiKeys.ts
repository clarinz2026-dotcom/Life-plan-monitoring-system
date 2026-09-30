import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  generateApiKey,
  looksLikeApiKey,
  sha256Hex,
} from "../lib/apiKeys";

/** Requests allowed per key per minute. */
export const API_RATE_LIMIT = 120;

/**
 * API key management.
 *
 * Only the Super Admin may mint, view, or revoke keys — not the CEO, not any
 * other role. The raw key is returned exactly once at creation; only its
 * SHA-256 hash and last 4 characters are stored. Revocation is a soft delete
 * (the row stays for the audit story) and takes effect immediately: the REST
 * endpoints re-check the hash on every request. Every management action is
 * appended to the audit trail.
 */

async function requireSuperAdmin(ctx: {
  db: any;
  auth: any;
}): Promise<{ userId: Id<"users">; name: string }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated.");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Not authenticated.");
  if (user.role !== "super_admin") {
    throw new Error("Only the Super Admin can manage API keys.");
  }
  return { userId, name: (user.name ?? user.email) || "Super Admin" };
}

/** Scope validator matching the schema's API_SCOPES literals. */
const scopeValidator = v.union(
  v.literal("clients"),
  v.literal("contracts"),
  v.literal("payments"),
);

/** Non-fingerprint fields of a key, safe to hand to the UI. */
function presentKey(doc: any) {
  return {
    _id: doc._id,
    name: doc.name,
    scopes: doc.scopes,
    keyLast4: doc.keyLast4,
    expiresAt: doc.expiresAt ?? null,
    revokedAt: doc.revokedAt ?? null,
    requestCount: doc.requestCount,
    lastUsedAt: doc.lastUsedAt ?? null,
    createdAt: doc.createdAt,
    createdByName: doc.createdByName ?? null,
  };
}

/** All keys, newest first. Every field shown is non-secret. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const keys = await ctx.db.query("api_keys").collect();
    return keys
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(presentKey);
  },
});

/** How many keys exist — used for the page's summary line. */
export const count = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const keys = await ctx.db.query("api_keys").collect();
    return {
      total: keys.length,
      active: keys.filter(
        (k) =>
          !k.revokedAt &&
          (!k.expiresAt || k.expiresAt > Date.now())
      ).length,
    };
  },
});

/**
 * Mint a new key. The raw key is included in the return value exactly once —
 * it is never persisted, logged, or sent anywhere else.
 */
export const create = mutation({
  args: {
    name: v.string(),
    scopes: v.array(scopeValidator),
    /** Lifespan in days; 0 or omitted means the key does not expire. */
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx);

    const name = args.name.trim();
    if (name.length < 2 || name.length > 60) {
      throw new Error("Give the key a name between 2 and 60 characters.");
    }

    // Deduplicate while preserving order.
    const scopes = Array.from(new Set(args.scopes));

    const rawKey = generateApiKey();
    if (!looksLikeApiKey(rawKey)) {
      throw new Error("Key generator failed its format check. Try again.");
    }
    const keyHash = await sha256Hex(rawKey);
    const keyLast4 = rawKey.slice(-4);
    const now = Date.now();
    const expiresAt =
      args.expiresInDays && args.expiresInDays > 0
        ? now + args.expiresInDays * 24 * 60 * 60 * 1000
        : undefined;

    const id = await ctx.db.insert("api_keys", {
      name,
      scopes,
      keyHash,
      keyLast4,
      expiresAt,
      requestCount: 0,
      createdById: actor.userId,
      createdByName: actor.name,
      createdAt: now,
    });

    await ctx.runMutation(api.audit.log, {
      action: "create",
      entityType: "api_key",
      entityId: id,
      description: `API key "${name}" created for external access (${scopes.join(", ") || "no scopes"}).`,
    });

    return { _id: id, rawKey };
  },
});

/** Revoke a key. It stops working on the next request; the row is kept. */
export const revoke = mutation({
  args: { id: v.id("api_keys") },
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx);
    const key = await ctx.db.get(args.id);
    if (!key) throw new Error("That API key no longer exists.");
    if (key.revokedAt) return { revoked: true };

    await ctx.db.patch(args.id, {
      revokedAt: Date.now(),
      revokedBy: actor.userId,
    });

    await ctx.runMutation(api.audit.log, {
      action: "status_change",
      entityType: "api_key",
      entityId: args.id,
      description: `API key "${key.name}" revoked by ${actor.name}.`,
    });

    return { revoked: true };
  },
});

/** Permanently remove a revoked key from the list. */
export const deleteKey = mutation({
  args: { id: v.id("api_keys") },
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx);
    const key = await ctx.db.get(args.id);
    if (!key) throw new Error("That API key no longer exists.");
    if (!key.revokedAt) {
      throw new Error("Revoke the key before deleting it.");
    }
    await ctx.db.delete(args.id);

    await ctx.runMutation(api.audit.log, {
      action: "delete",
      entityType: "api_key",
      entityId: args.id,
      description: `Revoked API key "${key.name}" deleted from the register by ${actor.name}.`,
    });

    return { deleted: true };
  },
});

// ─── Internal helpers used by the public REST endpoints (http.ts) ──────────

/**
 * Look up a key by hash. Internal so only the http actions can call it; the
 * public query refuses to accept a hash argument from the browser.
 */
export const findByHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("api_keys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .first();
    if (!doc) return null;
    if (doc.revokedAt) return { key: doc, reason: "revoked" as const };
    if (doc.expiresAt && doc.expiresAt <= Date.now()) {
      return { key: doc, reason: "expired" as const };
    }
    return { key: doc, reason: null };
  },
});

/** Throttled usage stamp — writes at most once per minute per (key, ip). */
export const recordUsage = internalMutation({
  args: { id: v.id("api_keys"), ip: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.id);
    if (!key) return;
    const now = Date.now();
    const last = key.lastUsedAt ?? 0;
    // Re-reads within the same minute only bump the request counter to keep
    // heavy integrations from writing a mutation per request.
    if (now - last < 60_000 && args.ip === key.lastUsedIp) {
      await ctx.db.patch(args.id, { requestCount: key.requestCount + 1 });
      return;
    }
    await ctx.db.patch(args.id, {
      lastUsedAt: now,
      lastUsedIp: args.ip,
      requestCount: key.requestCount + 1,
    });
  },
});

/**
 * Fixed-window rate limit. Consumes one request from the key's current
 * 60-second window and reports whether the call may proceed.
 */
export const consumeRateLimit = internalMutation({
  args: { id: v.id("api_keys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.id);
    if (!key) return { allowed: false, retryAfterSeconds: 60 };
    const now = Date.now();
    const windowStart = key.windowStart ?? 0;
    if (now - windowStart >= 60_000) {
      await ctx.db.patch(args.id, {
        windowStart: now,
        windowCount: 1,
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const next = (key.windowCount ?? 0) + 1;
    if (next > API_RATE_LIMIT) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStart + 60_000 - now) / 1000)),
      };
    }
    await ctx.db.patch(args.id, { windowCount: next });
    return { allowed: true, retryAfterSeconds: 0 };
  },
});
