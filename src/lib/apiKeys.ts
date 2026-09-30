/**
 * API key helpers — pure functions only, shared by the Convex functions, the
 * API Integration page, and the unit tests.
 *
 * Key format: `evfs_` + 64 lowercase hex chars (32 random bytes). The prefix
 * makes stray keys recognizable in logs and lets validators reject junk early.
 */

export const API_KEY_PREFIX = "evfs_";

/** Scopes a key may hold. Kept in sync with the schema's API_SCOPES. */
export const API_KEY_SCOPES = ["clients", "contracts", "payments"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const API_SCOPE_LABELS: Record<ApiKeyScope, string> = {
  clients: "Planholders (clients)",
  contracts: "Plans & balances (contracts)",
  payments: "Payment history (payments)",
};

export const API_SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  clients: "Planholder names, contact details, and beneficiaries.",
  contracts: "Plan type, plan value, amount paid, status, and branch.",
  payments: "Every payment: date, amount, channel, O.R. number, balance.",
};

/** True when the string looks like a well-formed key. Cheap pre-check only. */
export function looksLikeApiKey(value: string): boolean {
  return /^evfs_[0-9a-f]{64}$/.test(value);
}

/** Human identification for the UI: `evfs_…4f2a`. */
export function maskKey(last4: string): string {
  return `${API_KEY_PREFIX}…${last4}`;
}

/** True when `a` and `b` are equal without leaking length/timing differences. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** ISO date shown in the docs/examples (UTC, midnight). */
export function isoDay(t: number): string {
  return new Date(t).toISOString();
}

/** SHA-256 of a string as lowercase hex. Used to store key fingerprints. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Mint a new raw key. Called in the Super Admin's mutation; shown once. */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${API_KEY_PREFIX}${hex}`;
}
