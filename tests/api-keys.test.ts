import { describe, expect, it } from "vitest";
import {
  API_KEY_PREFIX,
  API_KEY_SCOPES,
  API_SCOPE_LABELS,
  looksLikeApiKey,
  maskKey,
  safeEqual,
  sha256Hex,
  generateApiKey,
} from "../src/lib/apiKeys";

describe("API key format", () => {
  it("generates keys with the evfs_ prefix and 64 hex chars", () => {
    const key = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key).toMatch(/^evfs_[0-9a-f]{64}$/);
    expect(looksLikeApiKey(key)).toBe(true);
  });

  it("generates unique keys", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).not.toBe(b);
  });

  it("rejects malformed keys", () => {
    expect(looksLikeApiKey("")).toBe(false);
    expect(looksLikeApiKey("evfs_")).toBe(false);
    expect(looksLikeApiKey("sk_live_abc123")).toBe(false);
    expect(looksLikeApiKey("evfs_zzz")).toBe(false);
    // Wrong length (63 chars) and uppercase hex are both invalid.
    expect(looksLikeApiKey(`evfs_${"a".repeat(63)}`)).toBe(false);
    expect(looksLikeApiKey(`evfs_${"A".repeat(64)}`)).toBe(false);
    expect(looksLikeApiKey(`evfs_${"a".repeat(65)}`)).toBe(false);
  });
});

describe("sha256Hex fingerprints", () => {
  it("produces the well-known SHA-256 of the empty string", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("is deterministic and full-length", async () => {
    const h1 = await sha256Hex("evfs_abc");
    const h2 = await sha256Hex("evfs_abc");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("masks keys by their last 4 characters", () => {
    expect(maskKey("4f2a")).toBe("evfs_…4f2a");
  });
});

describe("constant-time comparison", () => {
  it("matches identical strings", () => {
    expect(safeEqual("abcdef", "abcdef")).toBe(true);
    expect(safeEqual("", "")).toBe(true);
  });

  it("rejects differing strings of equal length", () => {
    expect(safeEqual("abcdef", "abcdeg")).toBe(false);
  });

  it("rejects different lengths", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("scopes", () => {
  it("exposes exactly the read-only resources", () => {
    expect(API_KEY_SCOPES).toEqual(["clients", "contracts", "payments"]);
  });

  it("labels every scope", () => {
    for (const s of API_KEY_SCOPES) {
      expect(API_SCOPE_LABELS[s].length).toBeGreaterThan(0);
    }
  });
});
