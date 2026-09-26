import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertStaff, isAdminRole } from "./access";
import type { Id } from "./_generated/dataModel";

/**
 * Official Receipt series assignation — the ledger of receipt books.
 *
 * The office buys official receipts in numbered series. A series is handed to
 * a collector or a branch manager, who then issues receipts from inside that
 * number range. This module records who holds which series, and over what
 * range, so a finance auditor can answer "who was allowed to issue 0042 to
 * 0100, and which branch did it belong to".
 *
 * Visibility follows the collector's own reach, not the branch filter used
 * elsewhere in the app:
 * - Finance staff, CEO and Super Admin see every series in the company,
 *   including which branch each one was released against.
 * - Branch managers and collectors see only the series assigned to them, so a
 *   collector can confirm what is in their own hand without seeing anyone
 *   else's book.
 *
 * Only Finance Staff, CEO and Super Admin may assign or revoke a series.
 */

/** Roles that see the whole company ledger. */
const FULL_LEDGER_ROLES = ["super_admin", "ceo", "finance_staff"] as const;

/** Roles that may hand out and take back a series. */
const ASSIGNER_ROLES = FULL_LEDGER_ROLES;

const canSeeAllSeries = (role: string | null) =>
  !!role && (FULL_LEDGER_ROLES as readonly string[]).includes(role);

const canAssignSeries = (role: string | null) =>
  !!role && (ASSIGNER_ROLES as readonly string[]).includes(role);

/** Branch positions that may hold a receipt book. */
const HOLDER_POSITIONS = ["collector", "branch_manager", "cashier"];

function requireAssigner(role: string | null) {
  if (!canAssignSeries(role)) {
    throw new Error(
      "Only Finance Staff, the CEO or the Super Admin can assign an OR series."
    );
  }
}

/** Series codes are compared case-insensitively but stored as typed. */
function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

/** How a holder is described in the ledger. */
function displayName(
  user: { name?: string; email?: string } | null | undefined
) {
  if (!user) return "Unknown";
  return user.name?.trim() || user.email || "Unknown";
}

export type ORSeriesRow = {
  _id: Id<"or_series">;
  seriesCode: string;
  prefix?: string;
  startNumber: number;
  endNumber: number;
  /** How many receipts the block holds. */
  count: number;
  assignedTo: Id<"users">;
  assignedToName: string;
  assignedToEmail?: string;
  assignedToRole?: string;
  assignedToPosition?: string;
  branchId?: Id<"branches">;
  branchName: string;
  assignedBy: Id<"users">;
  assignedByName: string;
  assignedAt: number;
  returnedAt?: number;
  notes?: string;
  status: "active" | "consumed" | "revoked";
};

/**
 * The ledger. Finance/admins see every series; everyone else sees only their
 * own. `branchId` narrows the company-wide view (Head Office and Finance).
 */
export const list = query({
  args: { branchId: v.optional(v.id("branches")) },
  handler: async (ctx, args): Promise<ORSeriesRow[]> => {
    const viewer = await assertStaff(ctx);
    const seeAll = canSeeAllSeries(viewer.role);

    // A holder's own book only — never the whole company's.
    const records = seeAll
      ? await ctx.db.query("or_series").withIndex("by_assignedAt").order("desc").collect()
      : await ctx.db
          .query("or_series")
          .withIndex("by_assignedTo", (q) => q.eq("assignedTo", viewer.userId))
          .order("desc")
          .collect();

    // The branch filter is a convenience for the company-wide view only. A
    // holder who submitted a branchId still gets their own rows.
    const scoped =
      seeAll && args.branchId
        ? records.filter((r) => r.branchId === args.branchId)
        : records;

    // One read per distinct id instead of per row.
    const userIds = Array.from(
      new Set(scoped.flatMap((r) => [r.assignedTo, r.assignedBy]))
    );
    const branchIds = Array.from(
      new Set(scoped.map((r) => r.branchId).filter(Boolean))
    ) as Id<"branches">[];

    const [users, branches] = await Promise.all([
      Promise.all(userIds.map((id) => ctx.db.get(id))),
      Promise.all(branchIds.map((id) => ctx.db.get(id))),
    ]);
    const userById = new Map(
      users.filter(Boolean).map((u) => [u!._id as string, u!] as const)
    );
    const branchById = new Map(
      branches.filter(Boolean).map((b) => [b!._id as string, b!] as const)
    );

    return scoped.map((r) => {
      const holder = userById.get(r.assignedTo);
      const issuer = userById.get(r.assignedBy);
      return {
        _id: r._id,
        seriesCode: r.seriesCode,
        prefix: r.prefix,
        startNumber: r.startNumber,
        endNumber: r.endNumber,
        count: r.endNumber - r.startNumber + 1,
        assignedTo: r.assignedTo,
        assignedToName: displayName(holder),
        assignedToEmail: holder?.email,
        assignedToRole: holder?.role,
        assignedToPosition: holder?.position,
        branchId: r.branchId,
        branchName: r.branchId
          ? (branchById.get(r.branchId)?.name ?? "Unknown branch")
          : "—",
        assignedBy: r.assignedBy,
        assignedByName: displayName(issuer),
        assignedAt: r.assignedAt,
        returnedAt: r.returnedAt,
        notes: r.notes,
        status: r.status,
      };
    });
  },
});

/**
 * Staff who can hold a series: collectors, cashiers and branch managers.
 * Used to populate the assign dialog. Assigner roles only.
 */
export const assignableStaff = query({
  args: { branchId: v.optional(v.id("branches")) },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    requireAssigner(viewer.role);

    const users = await ctx.db.query("users").collect();
    const branchIds = Array.from(
      new Set(users.map((u) => u.branchId).filter(Boolean))
    ) as Id<"branches">[];
    const branches = await Promise.all(branchIds.map((id) => ctx.db.get(id)));
    const branchById = new Map(
      branches.filter(Boolean).map((b) => [b!._id as string, b!] as const)
    );

    return users
      .filter((u) => {
        // Head Office and Finance release books; they do not hold one.
        if (
          u.role === "super_admin" ||
          u.role === "ceo" ||
          u.role === "finance_staff"
        ) {
          return false;
        }
        if (u.role === "cashier" || u.role === "manager") return true;
        // Position-only accounts (the "Assign Staff to Branch" flow sets a
        // position before a role) can still collect.
        return !!u.position && HOLDER_POSITIONS.includes(u.position);
      })
      .filter((u) => !args.branchId || u.branchId === args.branchId)
      .map((u) => ({
        _id: u._id as Id<"users">,
        name: displayName(u),
        email: u.email,
        role: u.role,
        position: u.position,
        branchId: u.branchId,
        branchName: u.branchId
          ? (branchById.get(u.branchId)?.name ?? "Unknown branch")
          : "—",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Hand a series to a collector or branch manager. */
export const assign = mutation({
  args: {
    seriesCode: v.string(),
    prefix: v.optional(v.string()),
    startNumber: v.number(),
    endNumber: v.number(),
    assignedTo: v.id("users"),
    /** Defaults to the holder's own branch. */
    branchId: v.optional(v.id("branches")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    requireAssigner(viewer.role);

    const code = args.seriesCode.trim();
    if (!code) throw new Error("Enter the series code, e.g. 2026-A.");
    if (!Number.isInteger(args.startNumber) || !Number.isInteger(args.endNumber)) {
      throw new Error("The start and end numbers must be whole numbers.");
    }
    if (args.startNumber < 1) {
      throw new Error("O.R. numbers start at 1 or above.");
    }
    if (args.endNumber < args.startNumber) {
      throw new Error("The end number must be the same as or higher than the start number.");
    }

    const holder = await ctx.db.get(args.assignedTo);
    if (!holder) throw new Error("That staff member no longer exists.");

    // One code, one book: a duplicate would make the ledger ambiguous.
    const normalized = normalizeCode(code);
    const clash = await ctx.db
      .query("or_series")
      .withIndex("by_seriesCode", (q) => q.eq("seriesCode", normalized))
      .first();
    if (clash) {
      throw new Error(
        `Series ${normalized} already exists on this ledger. Revoke it first or use a different code.`
      );
    }

    const branchId = args.branchId ?? holder.branchId ?? undefined;

    const seriesId = await ctx.db.insert("or_series", {
      seriesCode: code.toUpperCase(),
      prefix: args.prefix?.trim() || undefined,
      startNumber: args.startNumber,
      endNumber: args.endNumber,
      assignedTo: args.assignedTo,
      branchId,
      status: "active",
      assignedBy: viewer.userId,
      assignedAt: Date.now(),
      notes: args.notes?.trim() || undefined,
    });

    const branch = branchId ? await ctx.db.get(branchId) : null;
    const actor = await ctx.db.get(viewer.userId);
    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "or_series",
      entityId: seriesId,
      userId: viewer.userId,
      userName: displayName(actor),
      description: `OR series ${code.toUpperCase()} (${args.startNumber}–${args.endNumber}) assigned to ${displayName(holder)}${branch ? ` at ${branch.name}` : ""}`,
      newValues: {
        seriesCode: code.toUpperCase(),
        startNumber: args.startNumber,
        endNumber: args.endNumber,
        assignedTo: displayName(holder),
        branch: branch?.name,
      },
      branchId,
      timestamp: Date.now(),
    });

    return { seriesId };
  },
});

/** Take a series back from its holder. */
export const revoke = mutation({
  args: {
    seriesId: v.id("or_series"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    requireAssigner(viewer.role);

    const series = await ctx.db.get(args.seriesId);
    if (!series) throw new Error("That series is no longer on the ledger.");
    if (series.status === "revoked") {
      throw new Error(`Series ${series.seriesCode} was already revoked.`);
    }

    await ctx.db.patch(args.seriesId, {
      status: "revoked",
      returnedAt: Date.now(),
    });

    const holder = await ctx.db.get(series.assignedTo);
    const actor = await ctx.db.get(viewer.userId);
    await ctx.db.insert("audit_log", {
      action: "update",
      entityType: "or_series",
      entityId: args.seriesId,
      userId: viewer.userId,
      userName: displayName(actor),
      description: `OR series ${series.seriesCode} revoked from ${displayName(holder)}${args.reason ? ` — ${args.reason}` : ""}`,
      oldValues: { status: series.status },
      newValues: { status: "revoked" },
      branchId: series.branchId,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/** Mark a series as fully used up (its last receipt has been issued). */
export const markConsumed = mutation({
  args: { seriesId: v.id("or_series") },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    requireAssigner(viewer.role);

    const series = await ctx.db.get(args.seriesId);
    if (!series) throw new Error("That series is no longer on the ledger.");
    if (series.status !== "active") {
      throw new Error(`Series ${series.seriesCode} is already ${series.status}.`);
    }

    await ctx.db.patch(args.seriesId, { status: "consumed" });

    const holder = await ctx.db.get(series.assignedTo);
    const actor = await ctx.db.get(viewer.userId);
    await ctx.db.insert("audit_log", {
      action: "status_change",
      entityType: "or_series",
      entityId: args.seriesId,
      userId: viewer.userId,
      userName: displayName(actor),
      description: `OR series ${series.seriesCode} marked fully used by ${displayName(holder)}`,
      oldValues: { status: "active" },
      newValues: { status: "consumed" },
      branchId: series.branchId,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/** Whether the caller may assign/revoke, so the UI can hide those controls. */
export const myAccess = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await assertStaff(ctx);
    return {
      role: viewer.role,
      userId: viewer.userId,
      /** Company-wide ledger (Finance / CEO / Super Admin). */
      seesAllSeries: canSeeAllSeries(viewer.role),
      /** May hand out and revoke series. */
      canAssign: canAssignSeries(viewer.role),
      isAdmin: isAdminRole(viewer.role),
    };
  },
});
