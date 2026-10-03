/**
 * Privacy & compliance tests.
 *
 * These guard the promises the policies make. If a check here fails, either a
 * policy page is now describing something the code does not do, or a guard has
 * been weakened — both are the kind of regression nobody notices until a
 * planholder complains.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";
import { MAX_REQUESTS_PER_HOUR } from "../src/convex/privacy";
import type { Id } from "../src/convex/_generated/dataModel";
import {
  CONSENT_VERSION,
  DATA_PROCESSORS,
  MINOR_AGE,
  REQUEST_KINDS,
  STORAGE_INVENTORY,
  THIRD_PARTY_SERVICES,
  isMinor,
  isRequestKind,
  looksLikeEmail,
  requestKindLabel,
  validateRequest,
  type RequestDraft,
} from "../src/lib/legal";

// `_generated` must stay in the map — convex-test locates the project root from
// it. `airtable.ts` is excluded because it is a "use node" module and cannot be
// loaded in the edge runtime these tests run in.
const modules = import.meta.glob([
  "../src/convex/**/*.ts",
  "!../src/convex/**/*.test.ts",
  "!../src/convex/airtable.ts",
]);

const draft = (over: Partial<RequestDraft> = {}): RequestDraft => ({
  kind: "delete",
  name: "Dela Cruz, Juan",
  email: "juan@example.com",
  contactNumber: "0917 000 0000",
  ...over,
});

describe("data request validation", () => {
  test("a complete request passes", () => {
    expect(validateRequest(draft())).toEqual([]);
  });

  test("a plan number alone is enough to be found", () => {
    expect(
      validateRequest(draft({ contactNumber: "", planNumber: "0012345" }))
    ).toEqual([]);
  });

  test("an unknown request kind is refused", () => {
    const issues = validateRequest(draft({ kind: "erase-everything" }));
    expect(issues.map((i) => i.field)).toContain("kind");
  });

  test("an unreachable email address is refused", () => {
    const issues = validateRequest(draft({ email: "juan at example" }));
    expect(issues.map((i) => i.field)).toContain("email");
  });

  test("with no way to identify the record, the request is refused", () => {
    const issues = validateRequest(draft({ contactNumber: "", planNumber: "" }));
    expect(issues.map((i) => i.field)).toContain("contactNumber");
  });

  test("a single digit is not a contact number", () => {
    const issues = validateRequest(draft({ contactNumber: "1" }));
    expect(issues.map((i) => i.field)).toContain("contactNumber");
  });

  test("an over-long note is refused rather than silently truncated", () => {
    const issues = validateRequest(draft({ details: "x".repeat(2001) }));
    expect(issues.map((i) => i.field)).toContain("details");
  });

  test("every published kind is one the server accepts", () => {
    for (const kind of REQUEST_KINDS) {
      expect(isRequestKind(kind.value)).toBe(true);
      expect(requestKindLabel(kind.value)).toBe(kind.label);
    }
    expect(isRequestKind("nope")).toBe(false);
  });

  test("email checking is permissive enough for real addresses", () => {
    expect(looksLikeEmail("juan.delacruz+plans@example.co.uk")).toBe(true);
    expect(looksLikeEmail("juan@example")).toBe(false);
  });
});

describe("age rule for minors", () => {
  const year = 365.2425 * 24 * 60 * 60 * 1000;
  const now = Date.UTC(2030, 0, 1);

  test("a newborn is a minor", () => {
    expect(isMinor(now, now)).toBe(true);
  });

  test(`someone who turns ${MINOR_AGE} exactly today is an adult`, () => {
    expect(isMinor(now - MINOR_AGE * year, now)).toBe(false);
  });

  test("one day short of the birthday is still a minor", () => {
    expect(isMinor(now - MINOR_AGE * year + 86_400_000, now)).toBe(true);
  });
});

describe("published inventories are complete", () => {
  test("every third-party service says what it receives and links its terms", () => {
    for (const service of THIRD_PARTY_SERVICES) {
      expect(service.name.length).toBeGreaterThan(0);
      expect(service.purpose.length).toBeGreaterThan(10);
      expect(service.shares.length).toBeGreaterThan(0);
      expect(service.source.length).toBeGreaterThan(0);
      expect(service.url).toMatch(/^https:\/\//);
    }
  });

  test("the processors listed to planholders are the ones that touch data", () => {
    expect(DATA_PROCESSORS.length).toBeGreaterThan(0);
    for (const processor of DATA_PROCESSORS) {
      expect(["data", "account"]).toContain(processor.category);
    }
    expect(DATA_PROCESSORS.length).toBeLessThan(THIRD_PARTY_SERVICES.length);
  });

  test("every stored value is removable and explains itself", () => {
    expect(STORAGE_INVENTORY.length).toBeGreaterThan(0);
    for (const item of STORAGE_INVENTORY) {
      expect(item.removable).toBe(true);
      expect(item.purpose.length).toBeGreaterThan(5);
      expect(item.duration.length).toBeGreaterThan(0);
    }
  });
});

describe("the public request endpoint writes safely", () => {
  const goodDraft = {
    kind: "delete",
    name: "Dela Cruz, Juan",
    email: "juan@example.com",
    contactNumber: "0917 000 0000",
    planNumber: "",
    branch: "Malaybalay",
    details: "",
  };

  async function submit(
    t: {
      mutation: (
        fn: typeof internal.privacy.recordSubmission,
        args: Record<string, unknown>
      ) => Promise<{ ok: boolean; reference?: string; error?: string }>;
    },
    submitterKey: string,
    over: Partial<typeof goodDraft> = {}
  ) {
    return t.mutation(internal.privacy.recordSubmission, {
      draft: { ...goodDraft, ...over },
      submitterKey,
      now: Date.now(),
    });
  }

  test("a valid request is stored with a reference the office can quote", async () => {
    const t = convexTest(schema, modules);
    const result = await submit(t, "hash:bucket");

    expect(result.ok).toBe(true);
    expect(result.ok && result.reference).toMatch(/^PR-\d{4}-.{6}$/);

    const stored = await t.run(async (ctx) =>
      ctx.db.query("privacy_requests").collect()
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].kind).toBe("delete");
    expect(stored[0].status).toBe("submitted");
    // Blank optional fields are omitted rather than stored as "".
    expect(stored[0].planNumber).toBeUndefined();
  });

  test("the internal mutation re-validates, so a hand-crafted POST is filtered", async () => {
    const t = convexTest(schema, modules);
    const result = await submit(t, "hash:bucket", { email: "not-an-email" });

    expect(result).toMatchObject({ ok: false });
    const stored = await t.run(async (ctx) =>
      ctx.db.query("privacy_requests").collect()
    );
    expect(stored).toHaveLength(0);
  });

  test("submissions from one connection are rate limited", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < MAX_REQUESTS_PER_HOUR; i++) {
      const result = await submit(t, "hash:bucket");
      expect(result.ok).toBe(true);
    }

    const blocked = await submit(t, "hash:bucket");
    expect(blocked).toMatchObject({ ok: false });
    expect(blocked.ok === false && blocked.error).toMatch(/already received/);

    const stored = await t.run(async (ctx) =>
      ctx.db.query("privacy_requests").collect()
    );
    // The blocked attempt is refused, not queued.
    expect(stored).toHaveLength(MAX_REQUESTS_PER_HOUR);
  });

  test("a different connection has its own allowance", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < MAX_REQUESTS_PER_HOUR; i++) {
      await submit(t, "hash-a:bucket");
    }
    const other = await submit(t, "hash-b:bucket");
    expect(other.ok).toBe(true);
  });

  test("the raw IP address is never stored", async () => {
    const t = convexTest(schema, modules);
    await submit(t, "a1b2c3:1700000000");

    const rows = await t.run(async (ctx) =>
      ctx.db.query("privacy_requests").collect()
    );
    expect(rows[0].submitterHash).toBe("a1b2c3:1700000000");
    // No column anywhere holds an address, only its hash.
    expect(JSON.stringify(rows[0])).not.toContain("submitterIp");
  });
});

describe("the staff queue is branch scoped", () => {
  async function seedRequests() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const branchA = await ctx.db.insert("branches", {
        name: "A", code: "EVF-001", address: "1 A St", city: "Malaybalay City",
        province: "Bukidnon", isActive: true, createdAt: Date.now(),
      });
      const branchB = await ctx.db.insert("branches", {
        name: "B", code: "EVF-002", address: "2 B St", city: "Valencia City",
        province: "Bukidnon", isActive: true, createdAt: Date.now(),
      });
      const managerA = await ctx.db.insert("users", {
        name: "Manager A", email: "a@example.com", role: "manager",
        position: "branch_manager", branchId: branchA,
      });
      const managerB = await ctx.db.insert("users", {
        name: "Manager B", email: "b@example.com", role: "manager",
        position: "branch_manager", branchId: branchB,
      });
      const ceo = await ctx.db.insert("users", {
        name: "CEO", email: "ceo@example.com", role: "ceo",
      });

      const mk = (branchId?: Id<"branches">) =>
        ctx.db.insert("privacy_requests", {
          kind: "delete",
          name: "Someone",
          email: "someone@example.com",
          status: "submitted" as const,
          submitterHash: "h:1",
          submittedAt: Date.now(),
          branchId,
        });

      const requestA = await mk(branchA);
      const requestB = await mk(branchB);
      const unassigned = await mk();
      return { managerA, managerB, ceo, requestA, requestB, unassigned };
    });
    return { t, ...ids };
  }

  test("branch staff see their own queue plus un-routed requests", async () => {
    const { t, managerA, requestA } = await seedRequests();
    const rows = await t
      .withIdentity({ subject: managerA })
      .query(api.privacy.list, {});

    const ids = rows.map((r) => r._id);
    expect(ids).toContain(requestA);
    expect(ids).toHaveLength(2); // own branch + the one nobody claimed
  });

  test("Head Office sees every branch's requests", async () => {
    const { t, ceo, requestA, requestB } = await seedRequests();
    const rows = await t.withIdentity({ subject: ceo }).query(api.privacy.list, {});
    const ids = rows.map((r) => r._id);
    expect(ids).toContain(requestA);
    expect(ids).toContain(requestB);
  });

  test("a branch cannot route another branch's request", async () => {
    const { t, managerA, requestB } = await seedRequests();
    await expect(
      t.withIdentity({ subject: managerA }).mutation(api.privacy.updateRequest, {
        requestId: requestB,
        status: "completed",
        resolution: "Deleted.",
      })
    ).rejects.toThrow(/another branch/);
  });

  test("closing a request is written to the audit log", async () => {
    const { t, managerA, requestA } = await seedRequests();
    await t
      .withIdentity({ subject: managerA })
      .mutation(api.privacy.updateRequest, {
        requestId: requestA,
        status: "completed",
        resolution: "Planholder visited the branch with a valid ID.",
      });

    const entries = await t.run(async (ctx) =>
      ctx.db
        .query("audit_log")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "privacy_request").eq("entityId", requestA)
        )
        .collect()
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].description).toContain("valid ID");
  });
});

describe("consent is enforced by the server, not just the form", () => {
  async function setup() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const branchId = await ctx.db.insert("branches", {
        name: "Main",
        code: "EVF-001",
        address: "1 A Street",
        city: "Malaybalay City",
        province: "Bukidnon",
        isActive: true,
        createdAt: Date.now(),
      });
      const manager = await ctx.db.insert("users", {
        name: "Manager",
        email: "manager@example.com",
        role: "manager",
        position: "branch_manager",
        branchId,
      });
      return { branchId, manager };
    });
    return { t, ...ids };
  }

  const clientFields = {
    firstName: "Juan",
    lastName: "Dela Cruz",
    dateOfBirth: Date.UTC(1980, 0, 1),
    gender: "male" as const,
    contactNumber: "09170000001",
    address: "1 A Street",
    city: "Malaybalay City",
    province: "Bukidnon",
    zipCode: "8700",
    beneficiaryName: "Maria Dela Cruz",
    beneficiaryRelationship: "Spouse",
  };

  test("a record cannot be created without privacy consent", async () => {
    const { t, manager } = await setup();
    await expect(
      t.withIdentity({ subject: manager }).mutation(api.clients.create, {
        ...clientFields,
        consent: { privacy: false, role: "planholder" },
      })
    ).rejects.toThrow(/Consent is required/);
  });

  test("a guardian consent without a guardian name is refused", async () => {
    const { t, manager } = await setup();
    await expect(
      t.withIdentity({ subject: manager }).mutation(api.clients.create, {
        ...clientFields,
        consent: { privacy: true, role: "guardian" },
      })
    ).rejects.toThrow(/guardian's name/);
  });

  test("consent is stored with its wording version and the staff member", async () => {
    const { t, manager, branchId } = await setup();
    const clientId = await t
      .withIdentity({ subject: manager })
      .mutation(api.clients.create, {
        ...clientFields,
        consent: { privacy: true, role: "planholder" },
      });

    const stored = await t.run(async (ctx) => {
      const client = await ctx.db.get(clientId);
      const consentRows = await ctx.db
        .query("audit_log")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "consent").eq("entityId", clientId)
        )
        .collect();
      return { client, consentRows };
    });

    expect(stored.client?.consent?.privacy).toBe(true);
    expect(stored.client?.consent?.version).toBe(CONSENT_VERSION);
    expect(stored.client?.consent?.recordedBy).toBe(manager);
    expect(stored.client?.consent?.recordedByRole).toBe("planholder");
    expect(stored.client?.branchId).toBe(branchId);
    // The wording version is evidence, so it is in the audit trail too.
    expect(stored.consentRows).toHaveLength(1);
    expect(stored.consentRows[0].description).toContain(CONSENT_VERSION);
  });

  test("a guardian consent is recorded with the guardian's name", async () => {
    const { t, manager } = await setup();
    const clientId = await t
      .withIdentity({ subject: manager })
      .mutation(api.clients.create, {
        ...clientFields,
        consent: {
          privacy: true,
          role: "guardian",
          guardianName: "Rosa Dela Cruz",
        },
      });

    const stored = await t.run(async (ctx) => ctx.db.get(clientId));
    expect(stored?.consent?.recordedByRole).toBe("guardian");
    expect(stored?.consent?.guardianName).toBe("Rosa Dela Cruz");
  });
});