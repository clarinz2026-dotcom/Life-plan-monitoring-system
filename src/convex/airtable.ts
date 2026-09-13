"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import type { AirtablePayload } from "./airtableData";

/**
 * Airtable integration.
 *
 * Pushes this system's records into an Airtable base so staff can build their
 * own views, share read-only dashboards, and add automations. Records are
 * upserted on the "EFS ID" column (the record id in this system), so running a
 * sync repeatedly updates the same rows instead of duplicating them.
 *
 * ── Credentials (set these in the project's Keys / API keys tab) ───────────
 *   AIRTABLE_TOKEN    Airtable personal access token ("pat…")
 *   AIRTABLE_BASE_ID  Airtable base id ("app…")
 *
 * Required token scopes:
 *   data.records:read, data.records:write  — push records
 *   schema.bases:read                      — detect existing tables
 *   schema.bases:write                     — create the tables for you
 * …and the base must be included in the token's "Access" list.
 */

const API_BASE = "https://api.airtable.com/v0";
const META_BASE = "https://api.airtable.com/v0/meta/bases";

/** Airtable accepts at most 10 records per upsert request. */
const BATCH_SIZE = 10;
/** Airtable allows 5 requests/second per base — leave headroom between batches. */
const BATCH_PAUSE_MS = 250;

const TABLE_KEYS = ["clients", "contracts", "payments"] as const;
type TableKey = (typeof TABLE_KEYS)[number];

const TABLE_NAME: Record<TableKey, string> = {
  clients: "Clients",
  contracts: "Contracts",
  payments: "Payments",
};

type FieldSpec = {
  name: string;
  type: string;
  options?: Record<string, unknown>;
};

const text = (name: string): FieldSpec => ({ name, type: "singleLineText" });
const longText = (name: string): FieldSpec => ({ name, type: "multilineText" });
const number = (name: string): FieldSpec => ({
  name,
  type: "number",
  options: { precision: 2 },
});
const date = (name: string): FieldSpec => ({
  name,
  type: "date",
  options: { dateFormat: { name: "iso" } },
});
const dateTime = (name: string): FieldSpec => ({
  name,
  type: "dateTime",
  options: { dateFormat: { name: "iso" }, timeZone: "Asia/Manila" },
});
const email = (name: string): FieldSpec => ({ name, type: "email" });

/**
 * Column layout created by "Create missing tables". The first field becomes the
 * primary field, so the always-unique "EFS ID" leads each table.
 */
const TABLE_SPECS: Record<
  TableKey,
  { description: string; fields: FieldSpec[] }
> = {
  clients: {
    description:
      "Pre-need planholders synced from the Evangelist Funeral Services system.",
    fields: [
      text("EFS ID"),
      text("Full Name"),
      text("Last Name"),
      text("First Name"),
      text("Middle Name"),
      text("Branch"),
      date("Birth Date"),
      text("Gender"),
      text("Contact Number"),
      email("Email"),
      longText("Address"),
      text("City"),
      text("Province"),
      text("ZIP Code"),
      text("Occupation"),
      text("Beneficiary"),
      text("Beneficiary Relationship"),
      text("Beneficiary Contact"),
      longText("Notes"),
      dateTime("Created At"),
    ],
  },
  contracts: {
    description:
      "Memorial plan contracts synced from the Evangelist Funeral Services system.",
    fields: [
      text("EFS ID"),
      text("Contract No."),
      text("Planholder"),
      text("Planholder EFS ID"),
      text("Branch"),
      text("Plan Type"),
      number("Plan Amount"),
      number("Monthly Amortization"),
      number("Total Paid"),
      number("Balance"),
      text("Status"),
      date("Start Date"),
      date("Maturity Date"),
      dateTime("Created At"),
    ],
  },
  payments: {
    description:
      "Collections synced from the Evangelist Funeral Services system.",
    fields: [
      text("EFS ID"),
      dateTime("Payment Date"),
      text("Contract No."),
      text("Planholder"),
      text("Planholder EFS ID"),
      text("Branch"),
      number("Amount"),
      text("Channel"),
      text("O.R. No."),
      text("Reference No."),
      text("Recorded By"),
      longText("Remarks"),
      dateTime("Recorded At"),
    ],
  },
};

/* ─── Result shapes returned to the UI ────────────────────────────────────── */

export type TablePresence = {
  key: TableKey;
  name: string;
  exists: boolean;
};

export type AirtableStatus =
  | { state: "not_configured"; missingEnv: string[] }
  | { state: "error"; error: string; hint?: string }
  | {
      state: "ready";
      baseId: string;
      baseName: string | null;
      tables: TablePresence[];
      missing: TableKey[];
      canReadBase: boolean;
      viewer: string;
    };

export type EnsureTablesResult =
  | { state: "error"; error: string; hint?: string }
  | {
      state: "done";
      created: string[];
      skipped: string[];
      failed: Array<{ table: string; error: string }>;
    };

export type SyncTableResult = {
  key: TableKey;
  label: string;
  pushed: number;
  total: number;
  truncated: boolean;
  error?: string;
};

export type SyncOutcome =
  | { state: "error"; error: string; hint?: string }
  | { state: "done"; results: SyncTableResult[] };

/* ─── HTTP helpers ────────────────────────────────────────────────────────── */

type AirtableFailure = { error: string; hint?: string };

function credentials(): { token?: string; baseId?: string; missing: string[] } {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const missing: string[] = [];
  if (!token) missing.push("AIRTABLE_TOKEN");
  if (!baseId) missing.push("AIRTABLE_BASE_ID");
  return { token, baseId, missing };
}

const ERROR_HINTS: Record<number, string> = {
  401: "The Airtable token is missing, revoked, or mistyped. Create a new personal access token and update AIRTABLE_TOKEN.",
  403: "The token works but is missing a scope. Give it data.records:read, data.records:write, schema.bases:read and schema.bases:write — and add this base to the token's access list.",
  404: "Airtable could not find that base or table. Check AIRTABLE_BASE_ID (it starts with \"app\") and that the token can access that base.",
  422: "Airtable rejected the data — usually a column name or type that does not match. Use \"Create tables\" to rebuild the columns, then sync again.",
  429: "Airtable's rate limit was hit (5 requests/second per base). Wait a moment and run the sync again.",
};

function describe(status: number, body: unknown): AirtableFailure {
  let detail = "";
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string") detail = err;
    else if (err && typeof err === "object") {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string") detail = message;
    }
  }
  return {
    error: `Airtable API error ${status}${detail ? `: ${detail}` : ""}`,
    hint: ERROR_HINTS[status],
  };
}

async function request<T>(
  token: string,
  url: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const raw = await res.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = { error: raw.slice(0, 300) };
  }

  if (!res.ok) {
    const failure = describe(res.status, parsed);
    const error = new Error(failure.error) as Error & {
      hint?: string;
      status?: number;
    };
    error.hint = failure.hint;
    error.status = res.status;
    throw error;
  }

  return parsed as T;
}

function toFailure(err: unknown): AirtableFailure {
  const e = err as { message?: string; hint?: string };
  return {
    error: e?.message || "Could not reach Airtable.",
    hint: e?.hint,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ─── Table discovery ─────────────────────────────────────────────────────── */

type MetaTable = { id: string; name: string };

/**
 * Read the base's name and table names via the metadata API
 * (`schema.bases:read`). When the token lacks that scope the caller falls back
 * to probing the data API per table.
 */
async function readBase(
  token: string,
  baseId: string
): Promise<{ names: Set<string>; baseName: string | null; canReadBase: boolean }> {
  try {
    const [bases, tables] = await Promise.all([
      request<{ bases?: Array<{ id: string; name: string }> }>(token, META_BASE),
      request<{ tables?: MetaTable[] }>(token, `${META_BASE}/${baseId}/tables`),
    ]);
    const match = (bases.bases ?? []).find((b) => b.id === baseId);
    return {
      names: new Set((tables.tables ?? []).map((t) => t.name)),
      baseName: match?.name ?? baseId,
      canReadBase: true,
    };
  } catch {
    return { names: new Set(), baseName: null, canReadBase: false };
  }
}

/**
 * Fallback existence check for tokens without metadata access.
 * A 404 means the table really is missing; any other status is an access
 * problem that the caller should surface instead of reporting "missing table".
 */
async function probeTable(
  token: string,
  baseId: string,
  tableName: string
): Promise<{ exists: boolean; failure?: AirtableFailure }> {
  try {
    await request<unknown>(
      token,
      `${API_BASE}/${baseId}/${encodeURIComponent(tableName)}?maxRecords=1`
    );
    return { exists: true };
  } catch (err) {
    const e = err as { status?: number };
    if (e?.status === 404) return { exists: false };
    return { exists: false, failure: toFailure(err) };
  }
}

async function tablePresence(
  token: string,
  baseId: string,
  base: { names: Set<string>; canReadBase: boolean }
): Promise<{ tables: TablePresence[]; failure?: AirtableFailure }> {
  const tables: TablePresence[] = [];
  for (const key of TABLE_KEYS) {
    const name = TABLE_NAME[key];
    if (base.canReadBase) {
      tables.push({ key, name, exists: base.names.has(name) });
      continue;
    }
    const probe = await probeTable(token, baseId, name);
    if (probe.failure) return { tables, failure: probe.failure };
    tables.push({ key, name, exists: probe.exists });
  }
  return { tables };
}

/* ─── Actions ─────────────────────────────────────────────────────────────── */

/** Confirm staff access and report the connection + table state. */
export const status = action({
  args: {},
  handler: async (ctx): Promise<AirtableStatus> => {
    let caller: { name: string };
    try {
      caller = await ctx.runQuery(internal.airtableData.whoAmI);
    } catch (err) {
      return { state: "error", ...toFailure(err) };
    }

    const { token, baseId, missing } = credentials();
    if (missing.length > 0) {
      return { state: "not_configured", missingEnv: missing };
    }

    const base = await readBase(token!, baseId!);
    const { tables, failure } = await tablePresence(token!, baseId!, base);
    if (failure) return { state: "error", ...failure };

    return {
      state: "ready",
      baseId: baseId!,
      baseName: base.baseName,
      tables,
      missing: tables.filter((t) => !t.exists).map((t) => t.key),
      canReadBase: base.canReadBase,
      viewer: caller.name,
    };
  },
});

/**
 * Create any missing tables (with their columns).
 * Requires the `schema.bases:write` scope.
 */
export const ensureTables = action({
  args: {},
  handler: async (ctx): Promise<EnsureTablesResult> => {
    try {
      await ctx.runQuery(internal.airtableData.whoAmI);
    } catch (err) {
      return { state: "error", ...toFailure(err) };
    }

    const { token, baseId, missing } = credentials();
    if (missing.length > 0) {
      return {
        state: "error",
        error: "Airtable is not connected yet.",
        hint: `Add ${missing.join(" and ")} in the Keys tab, then try again.`,
      };
    }

    const base = await readBase(token!, baseId!);
    const created: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ table: string; error: string }> = [];

    for (const key of TABLE_KEYS) {
      const name = TABLE_NAME[key];

      if (base.canReadBase) {
        if (base.names.has(name)) {
          skipped.push(name);
          continue;
        }
      } else {
        const probe = await probeTable(token!, baseId!, name);
        if (probe.failure) return { state: "error", ...probe.failure };
        if (probe.exists) {
          skipped.push(name);
          continue;
        }
      }

      try {
        await request(token!, `${META_BASE}/${baseId}/tables`, {
          method: "POST",
          body: { name, description: TABLE_SPECS[key].description, fields: TABLE_SPECS[key].fields },
        });
        created.push(name);
      } catch (err) {
        failed.push({ table: name, error: toFailure(err).error });
      }
    }

    return { state: "done", created, skipped, failed };
  },
});

/**
 * Upsert records into the base, keyed on "EFS ID" so repeated runs update the
 * same rows instead of creating duplicates.
 */
export const sync = action({
  args: {
    tables: v.optional(
      v.array(
        v.union(v.literal("clients"), v.literal("contracts"), v.literal("payments"))
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncOutcome> => {
    let caller: { name: string };
    try {
      caller = await ctx.runQuery(internal.airtableData.whoAmI);
    } catch (err) {
      return { state: "error", ...toFailure(err) };
    }

    const { token, baseId, missing } = credentials();
    if (missing.length > 0) {
      return {
        state: "error",
        error: "Airtable is not connected yet.",
        hint: `Add ${missing.join(" and ")} in the Keys tab, then run the sync again.`,
      };
    }

    const keys: TableKey[] =
      args.tables && args.tables.length > 0 ? args.tables : [...TABLE_KEYS];

    const base = await readBase(token!, baseId!);

    // Refuse to start when a target table is missing — otherwise every batch
    // would fail with the same confusing error.
    const missingTables: string[] = [];
    for (const key of keys) {
      const name = TABLE_NAME[key];
      if (base.canReadBase) {
        if (!base.names.has(name)) missingTables.push(name);
        continue;
      }
      const probe = await probeTable(token!, baseId!, name);
      if (probe.failure) return { state: "error", ...probe.failure };
      if (!probe.exists) missingTables.push(name);
    }
    if (missingTables.length > 0) {
      return {
        state: "error",
        error: `The Airtable base is missing: ${missingTables.join(", ")}.`,
        hint: "Press \"Create tables\" first (it needs the schema.bases:write scope), or create them yourself with the columns in the setup guide.",
      };
    }

    const results: SyncTableResult[] = [];

    for (const key of keys) {
      const label = TABLE_NAME[key];

      let payload: AirtablePayload;
      try {
        payload = await loadPayload(ctx, key, args.limit);
      } catch (err) {
        results.push({
          key,
          label,
          pushed: 0,
          total: 0,
          truncated: false,
          error: toFailure(err).error,
        });
        continue;
      }

      let pushed = 0;
      let tableError: string | undefined;

      for (let i = 0; i < payload.records.length; i += BATCH_SIZE) {
        const batch = payload.records.slice(i, i + BATCH_SIZE);
        try {
          const response = await request<{ records?: unknown[] }>(
            token!,
            `${API_BASE}/${baseId}/${encodeURIComponent(label)}`,
            {
              method: "PATCH",
              body: {
                records: batch,
                performUpsert: { fieldsToMergeOn: ["EFS ID"] },
                typecast: true,
              },
            }
          );
          pushed += response.records?.length ?? batch.length;
        } catch (err) {
          tableError = toFailure(err).error;
          break; // stop this table, keep going with the others
        }
        if (i + BATCH_SIZE < payload.records.length) await sleep(BATCH_PAUSE_MS);
      }

      results.push({
        key,
        label,
        pushed,
        total: payload.total,
        truncated: payload.truncated,
        error: tableError,
      });
    }

    const totalPushed = results.reduce((sum, r) => sum + r.pushed, 0);
    try {
      await ctx.runMutation(internal.airtableData.logSync, {
        summary: `Airtable sync by ${caller.name}: ${totalPushed} record(s) upserted (${results
          .map((r) => `${r.label} ${r.pushed}`)
          .join(", ")})`,
        details: { baseId: baseId!, results },
      });
    } catch {
      // The audit entry is best-effort — never fail a completed sync for it.
    }

    return { state: "done", results };
  },
});

/** Small switch so each internal payload query gets its own args. */
async function loadPayload(
  ctx: ActionCtx,
  key: TableKey,
  limit?: number
): Promise<AirtablePayload> {
  switch (key) {
    case "clients":
      return await ctx.runQuery(internal.airtableData.clients, { limit });
    case "contracts":
      return await ctx.runQuery(internal.airtableData.contracts, { limit });
    case "payments":
      return await ctx.runQuery(internal.airtableData.payments, { limit });
  }
}
