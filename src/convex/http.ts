import { httpRouter, httpActionGeneric } from "convex/server";
import { auth } from "./auth";
import { api, internal } from "./_generated/api";
import { API_RATE_LIMIT } from "./apiKeys";
import { looksLikeApiKey, sha256Hex } from "../lib/apiKeys";
import type { ApiKeyScope } from "../lib/apiKeys";

/**
 * Public read-only REST API.
 *
 * Endpoints (all GET, all JSON):
 *   GET /api/v1/planholders            → list clients
 *   GET /api/v1/planholders/:id        → one client + their plans
 *   GET /api/v1/plans                  → list contracts
 *   GET /api/v1/payments               → list payments
 *
 * Authentication: `Authorization: Bearer evfs_…`. Keys are minted on the
 * staff portal's API Integration page by the Super Admin only. Scopes decide
 * which endpoints a key may call; every request is rate-limited to
 * API_RATE_LIMIT per minute per key and usage is recorded on the key.
 */

// Max rows per page; the UI advertises the same cap in its docs.
export const MAX_PAGE_SIZE = 500;
const DEFAULT_PAGE_SIZE = 100;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Cache-Control",
  "Access-Control-Max-Age": "86400",
};

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS,
      ...extraHeaders,
    },
  });
}

function errorJson(
  status: number,
  code: string,
  message: string,
  extraHeaders: Record<string, string> = {}
): Response {
  return json({ error: { code, message } }, status, extraHeaders);
}

type AuthResult =
  | { ok: true; keyId: string; scopes: readonly ApiKeyScope[] }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      extraHeaders?: Record<string, string>;
    };

type ActionCtx = {
  runQuery: (fn: any, args: any) => Promise<unknown>;
  runMutation: (fn: any, args: any) => Promise<unknown>;
};

/**
 * Authenticate a request against its Bearer key. Hashes the presented key and
 * looks it up; expired/revoked keys are rejected with distinct codes, then the
 * per-key rate limit is consumed.
 */
async function authenticate(
  ctx: ActionCtx,
  req: Request
): Promise<AuthResult> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return {
      ok: false,
      status: 401,
      code: "missing_credentials",
      message:
        "Send your key as: Authorization: Bearer evfs_… — keys are created on the API Integration page of the staff portal.",
    };
  }
  const rawKey = header.slice(7).trim();
  if (!looksLikeApiKey(rawKey)) {
    return {
      ok: false,
      status: 401,
      code: "invalid_key_format",
      message: "That is not a valid key. Keys look like evfs_ followed by 64 hex characters.",
    };
  }

  const keyHash = await sha256Hex(rawKey);
  const found = (await ctx.runQuery(internal.apiKeys.findByHash, { keyHash })) as {
    key: { _id: string; scopes: ApiKeyScope[] };
    reason: "revoked" | "expired" | null;
  } | null;

  if (!found) {
    return {
      ok: false,
      status: 401,
      code: "unknown_key",
      message: "This key does not exist. Check for typos or create a new one on the API Integration page.",
    };
  }
  if (found.reason === "revoked") {
    return {
      ok: false,
      status: 401,
      code: "key_revoked",
      message: "This key has been revoked. Ask the Super Admin for a new one.",
    };
  }
  if (found.reason === "expired") {
    return {
      ok: false,
      status: 401,
      code: "key_expired",
      message: "This key has expired. Ask the Super Admin to issue a fresh one.",
    };
  }

  const rate = (await ctx.runMutation(internal.apiKeys.consumeRateLimit, {
    id: found.key._id,
  })) as { allowed: boolean; retryAfterSeconds: number };

  if (!rate.allowed) {
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      message: `Rate limit of ${API_RATE_LIMIT} requests per minute exceeded for this key.`,
      extraHeaders: {
        "Retry-After": String(rate.retryAfterSeconds),
      },
    };
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  await ctx.runMutation(internal.apiKeys.recordUsage, {
    id: found.key._id,
    ip,
  });

  return { ok: true, keyId: found.key._id, scopes: found.key.scopes };
}

/**
 * Scope gate: a key needs the listed scope to call an endpoint. Missing scope
 * is 403 (not 401) — the key is valid but not allowed here.
 */
function requireScope(
  authResult: AuthResult,
  scope: ApiKeyScope
): Response | null {
  if (authResult.ok && authResult.scopes.includes(scope)) return null;
  if (authResult.ok) {
    return errorJson(
      403,
      "scope_missing",
      `This key does not include the \"${scope}\" scope. Ask the Super Admin to issue a key with that scope.`
    );
  }
  const a = authResult as Extract<AuthResult, { ok: false }>;
  return errorJson(a.status, a.code, a.message, a.extraHeaders ?? {});
}

function parseLimit(url: URL): number | Response {
  const raw = url.searchParams.get("limit");
  if (raw === null) return DEFAULT_PAGE_SIZE;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_SIZE) {
    return errorJson(
      400,
      "bad_limit",
      `"limit" must be an integer between 1 and ${MAX_PAGE_SIZE}.`
    );
  }
  return n;
}

function parseSince(url: URL): number | undefined | Response {
  const raw = url.searchParams.get("since");
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return errorJson(
      400,
      "bad_since",
      `"since" must be a Unix timestamp in milliseconds.`
    );
  }
  return n;
}

function parseStatus(url: URL): string | undefined | Response {
  const raw = url.searchParams.get("status");
  if (raw === null) return undefined;
  const valid = ["current", "delinquent_30", "delinquent_60", "delinquent_90", "lapsed", "fully_paid"];
  if (!valid.includes(raw)) {
    return errorJson(
      400,
      "bad_status",
      `"status" must be one of: ${valid.join(", ")}.`
    );
  }
  return raw;
}

function parseIntArg(
  url: URL,
  name: string
): string | undefined | Response {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  // Convex ids are base-16-ish 32-char strings; a length check is enough to
  // keep obviously-wrong values out.
  if (!/^[0-9a-z]{10,48}$/i.test(raw)) {
    return errorJson(400, `bad_${name}`, `"${name}" is not a valid id.`);
  }
  return raw;
}

// ─── Route handlers ────────────────────────────────────────────────────────

async function handleOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS });
}

async function handleListClients(ctx: ActionCtx, req: Request): Promise<Response> {
  const a = await authenticate(ctx, req);
  const scopeErr = requireScope(a, "clients");
  if (scopeErr) return scopeErr;
  const url = new URL(req.url);
  const limitOrErr = parseLimit(url);
  if (limitOrErr instanceof Response) return limitOrErr;
  const sinceOrErr = parseSince(url);
  if (sinceOrErr instanceof Response) return sinceOrErr;
  const rows = (await ctx.runQuery(internal.apiData.listClients, {
    limit: limitOrErr as number,
    updatedSince: sinceOrErr as number | undefined,
  })) as unknown[];
  return json({ data: rows, count: rows.length });
}

async function handleGetClient(
  ctx: ActionCtx,
  req: Request,
  clientId: string
): Promise<Response> {
  const a = await authenticate(ctx, req);
  const scopeErr = requireScope(a, "clients");
  if (scopeErr) return scopeErr;
  const row = (await ctx.runQuery(internal.apiData.getClient, {
    clientId: clientId as any,
  })) as unknown;
  if (!row) {
    return errorJson(404, "not_found", "No planholder with that id.");
  }
  return json({ data: row });
}

async function handleListContracts(ctx: ActionCtx, req: Request): Promise<Response> {
  const a = await authenticate(ctx, req);
  const scopeErr = requireScope(a, "contracts");
  if (scopeErr) return scopeErr;
  const url = new URL(req.url);
  const limitOrErr = parseLimit(url);
  if (limitOrErr instanceof Response) return limitOrErr;
  const sinceOrErr = parseSince(url);
  if (sinceOrErr instanceof Response) return sinceOrErr;
  const statusOrErr = parseStatus(url);
  if (statusOrErr instanceof Response) return statusOrErr;
  const rows = (await ctx.runQuery(internal.apiData.listContracts, {
    limit: limitOrErr as number,
    updatedSince: sinceOrErr as number | undefined,
    status: statusOrErr as any,
  })) as unknown[];
  return json({ data: rows, count: rows.length });
}

async function handleListPayments(ctx: ActionCtx, req: Request): Promise<Response> {
  const a = await authenticate(ctx, req);
  const scopeErr = requireScope(a, "payments");
  if (scopeErr) return scopeErr;
  const url = new URL(req.url);
  const limitOrErr = parseLimit(url);
  if (limitOrErr instanceof Response) return limitOrErr;
  const sinceOrErr = parseSince(url);
  if (sinceOrErr instanceof Response) return sinceOrErr;
  const clientIdOrErr = parseIntArg(url, "clientId");
  if (clientIdOrErr instanceof Response) return clientIdOrErr;
  const rows = (await ctx.runQuery(internal.apiData.listPayments, {
    limit: limitOrErr as number,
    updatedSince: sinceOrErr as number | undefined,
    clientId: clientIdOrErr as any,
  })) as unknown[];
  return json({ data: rows, count: rows.length });
}

/** Introspection endpoint: what the key can see (no data). */
async function handleWhoAmI(ctx: ActionCtx, req: Request): Promise<Response> {
  const a = await authenticate(ctx, req);
  if (!a.ok) {
    const err = a as Extract<AuthResult, { ok: false }>;
    return errorJson(err.status, err.code, err.message, err.extraHeaders ?? {});
  }
  return json({
    scopes: a.scopes,
    endpoints: {
      clients: a.scopes.includes("clients")
        ? ["/api/v1/planholders", "/api/v1/planholders/:id"]
        : undefined,
      contracts: a.scopes.includes("contracts") ? "/api/v1/plans" : undefined,
      payments: a.scopes.includes("payments") ? "/api/v1/payments" : undefined,
    },
  });
}

/** Self-describing 404 with the endpoint catalogue. */
async function handleIndex(): Promise<Response> {
  return json(
    {
      name: "Evangelist Funeral Services API",
      version: "v1",
      auth: "Authorization: Bearer evfs_…",
      endpoints: [
        { method: "GET", path: "/api/v1", description: "This catalogue (no key needed)." },
        { method: "GET", path: "/api/v1/me", description: "Key introspection (any valid key)." },
        { method: "GET", path: "/api/v1/planholders", scope: "clients", description: "List planholders." },
        { method: "GET", path: "/api/v1/planholders/:id", scope: "clients", description: "One planholder with plans." },
        { method: "GET", path: "/api/v1/plans", scope: "contracts", description: "List contracts/plans." },
        { method: "GET", path: "/api/v1/payments", scope: "payments", description: "List payments." },
      ],
      docs: "Keys and scopes are managed on the staff portal → API Integration (Super Admin only).",
    },
    200
  );
}

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/api/v1",
  method: "GET",
  handler: httpActionGeneric(async () => handleIndex()),
});

http.route({
  path: "/api/v1",
  method: "OPTIONS",
  handler: httpActionGeneric(async () => handleOptions()),
});

http.route({
  path: "/api/v1/me",
  method: "GET",
  handler: httpActionGeneric(async (ctx, request) =>
    handleWhoAmI(ctx, request)
  ),
});

http.route({
  pathPrefix: "/api/v1/",
  method: "OPTIONS",
  handler: httpActionGeneric(async () => handleOptions()),
});

http.route({
  path: "/api/v1/planholders",
  method: "GET",
  handler: httpActionGeneric(async (ctx, request) =>
    handleListClients(ctx, request)
  ),
});

http.route({
  pathPrefix: "/api/v1/planholders/",
  method: "GET",
  handler: httpActionGeneric(async (ctx, request) => {
    const url = new URL(request.url);
    const clientId = url.pathname
      .replace("/api/v1/planholders/", "")
      .replace(/\/$/, "");
    if (!clientId) return handleListClients(ctx, request);
    return handleGetClient(ctx, request, clientId);
  }),
});

http.route({
  path: "/api/v1/plans",
  method: "GET",
  handler: httpActionGeneric(async (ctx, request) =>
    handleListContracts(ctx, request)
  ),
});

http.route({
  path: "/api/v1/payments",
  method: "GET",
  handler: httpActionGeneric(async (ctx, request) =>
    handleListPayments(ctx, request)
  ),
});

// 404 for anything else under /api — keeps the API self-describing.
http.route({
  pathPrefix: "/api/",
  method: "GET",
  handler: httpActionGeneric(async ({ }, request) => {
    return errorJson(
      404,
      "not_found",
      `Unknown API path: ${new URL(request.url).pathname}. See GET /api/v1 for the endpoint catalogue.`
    );
  }),
});

export default http;
