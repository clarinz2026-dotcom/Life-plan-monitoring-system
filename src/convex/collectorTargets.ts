import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertStaff, isAdminRole, resolveBranchFilter } from "./access";
import type { Id } from "./_generated/dataModel";

/**
 * Collector targets — the monthly collection quota a Collector Supervisor sets
 * for each collector in their branch.
 *
 * The target itself is only a plan. What the collector actually achieved is
 * summed from the payments table at read time (`recordedBy` within the month),
 * so a target can never drift away from the ledger the way a stored "collected"
 * column would. Archived payments (a reversed receipt) are excluded, matching
 * how every other total in the app is computed.
 *
 * Scope follows the app's usual branch rule: Head Office (Super Admin / CEO)
 * may pass any branch, everyone else — including a Collector Supervisor — has
 * their own branch forced, so tampering with `branchId` from the browser
 * exposes nothing.
 */

/** Roles allowed to set and clear a collector's target. */
const TARGET_MANAGER_ROLES = [
  "super_admin",
  "ceo",
  "manager",
  "collector_supervisor",
] as const;

const canManageTargets = (role: string | null) =>
  !!role && (TARGET_MANAGER_ROLES as readonly string[]).includes(role);

/** Positions whose staff member works toward a collection target. */
const TARGET_HOLDER_POSITIONS = ["collector", "cashier", "branch_manager"];

function requireTargetManager(role: string | null) {
  if (!canManageTargets(role)) {
    throw new Error(
      "Only a Branch Manager, the Collector Supervisor, the CEO or the Super Admin can set collection targets."
    );
  }
}

function displayName(user: { name?: string; email?: string } | null | undefined) {
  if (!user) return "Unknown";
  return user.name?.trim() || user.email || "Unknown";
}

/** First instant of the month containing `ts`, in the server's timezone. */
export function monthStart(ts: number) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** `YYYY-MM` label for a month timestamp. */
export function monthLabel(month: number) {
  const d = new Date(month);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type TargetRow = {
  collectorId: Id<"users">;
  collectorName: string;
  collectorEmail?: string;
  collectorRole?: string;
  collectorPosition?: string;
  targetAmount: number;
  /** Collected by this collector inside the month, from real payments. */
  collectedAmount: number;
  /** collectedAmount / targetAmount, as a fraction. 0 when no target is set. */
  attainment: number;
  /** Payment count behind collectedAmount, for the ledger cross-check. */
  paymentCount: number;
  notes?: string;
  setByName: string;
  setAt: number;
};

/**
 * Every collector in scope with their target and attainment for the month.
 *
 * Collectors with no target are still listed (attainment 0) so the supervisor
 * sees the whole team rather than only the people already given a quota.
 */
export const list = query({
  args: {
    month: v.optional(v.number()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args): Promise<TargetRow[]> => {
    const viewer = await assertStaff(ctx);
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    const month = monthStart(args.month ?? Date.now());

    const staff = await ctx.db.query("users").collect();
    // `branchId` is undefined only for Head Office asking for the whole
    // company (resolveBranchFilter forces it for everyone else). Those rows
    // are read per-branch below, so a company-wide view has to scan each
    // branch's targets rather than hit the by_branch_month index once.
    const scoped =
      branchId === undefined
        ? staff.filter((u) => u.branchId !== undefined)
        : staff.filter((u) => u.branchId === branchId);

    // Someone works toward a target if they hold a collection position, or
    // their role is one that collects.
    const isCollector = (u: (typeof scoped)[number]) =>
      (u.position !== undefined &&
        TARGET_HOLDER_POSITIONS.includes(u.position as string)) ||
      u.role === "cashier" ||
      u.role === "finance_staff";

    const collectors = scoped.filter(isCollector);
    if (collectors.length === 0) return [];

    // Every target row in scope for this month.
    const targets = branchId === undefined
      ? (await ctx.db
          .query("collector_targets")
          .withIndex("by_month", (q) => q.eq("month", month))
          .collect())
      : await ctx.db
          .query("collector_targets")
          .withIndex("by_branch_month", (q) =>
            q.eq("branchId", branchId!).eq("month", month)
          )
          .collect();
    const targetByCollector = new Map(targets.map((t) => [t.collectorId, t]));

    // Actual collections: payments this collector recorded inside the month.
    const monthEnd = new Date(
      new Date(month).getFullYear(),
      new Date(month).getMonth() + 1,
      1
    ).getTime();
    const payments = branchId === undefined
      ? await ctx.db.query("payments").collect()
      : await ctx.db
          .query("payments")
          .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
          .collect();

    const monthPayments = payments.filter(
      (p) =>
        p.paymentDate >= month &&
        p.paymentDate < monthEnd &&
        !p.archivedAt &&
        (branchId === undefined || p.branchId === branchId)
    );

    const byCollector = new Map<
      string,
      { amount: number; count: number }
    >();
    for (const p of monthPayments) {
      const key = String(p.recordedBy);
      const cur = byCollector.get(key) ?? { amount: 0, count: 0 };
      cur.amount += p.amount;
      cur.count += 1;
      byCollector.set(key, cur);
    }

    const setterIds = Array.from(
      new Set(targets.map((t) => t.setBy))
    ) as Id<"users">[];
    const setters = await Promise.all(setterIds.map((id) => ctx.db.get(id)));
    const setterById = new Map(
      setters.filter(Boolean).map((s) => [s!._id as string, s!] as const)
    );

    return collectors
      .map((u) => {
        const target = targetByCollector.get(u._id);
        const actual = byCollector.get(String(u._id)) ?? { amount: 0, count: 0 };
        const targetAmount = target?.targetAmount ?? 0;
        return {
          collectorId: u._id as Id<"users">,
          collectorName: displayName(u),
          collectorEmail: u.email,
          collectorRole: u.role,
          collectorPosition: u.position,
          targetAmount,
          collectedAmount: actual.amount,
          attainment: targetAmount > 0 ? actual.amount / targetAmount : 0,
          paymentCount: actual.count,
          notes: target?.notes,
          setByName: target
            ? displayName(setterById.get(target.setBy))
            : "Not set",
          setAt: target?.setAt ?? 0,
        };
      })
      .sort((a, b) => b.collectorName.localeCompare(a.collectorName));
  },
});

/** Set (or replace) one collector's target for a month. */
export const setTarget = mutation({
  args: {
    collectorId: v.id("users"),
    month: v.optional(v.number()),
    targetAmount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    requireTargetManager(viewer.role);

    if (!Number.isFinite(args.targetAmount) || args.targetAmount < 0) {
      throw new Error("The target must be zero or a positive amount.");
    }

    // The collector must be in the manager's own branch. A supervisor cannot
    // set a target for a collector in another branch by passing their id.
    if (!isAdminRole(viewer.role)) {
      if (!viewer.branchId) {
        throw new Error(
          "Your account is not assigned to a branch yet. Ask Head Office to assign you to one."
        );
      }
      const collector = await ctx.db.get(args.collectorId);
      if (!collector) throw new Error("That collector no longer exists.");
      if (collector.branchId !== viewer.branchId) {
        throw new Error("You can only set targets for collectors in your branch.");
      }
    }

    const collector = await ctx.db.get(args.collectorId);
    if (!collector) throw new Error("That collector no longer exists.");

    const month = monthStart(args.month ?? Date.now());
    const existing = await ctx.db
      .query("collector_targets")
      .withIndex("by_collector_month", (q) =>
        q.eq("collectorId", args.collectorId).eq("month", month)
      )
      .first();

    const setAt = Date.now();
    const branchId = collector.branchId ?? viewer.branchId ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        targetAmount: args.targetAmount,
        notes: args.notes?.trim() || undefined,
        setBy: viewer.userId,
        setAt,
        branchId,
      });
    } else {
      await ctx.db.insert("collector_targets", {
        collectorId: args.collectorId,
        month,
        targetAmount: args.targetAmount,
        notes: args.notes?.trim() || undefined,
        setBy: viewer.userId,
        setAt,
        branchId,
      });
    }

    const actor = await ctx.db.get(viewer.userId);
    await ctx.db.insert("audit_log", {
      action: existing ? "update" : "create",
      entityType: "collector_target",
      entityId: String(args.collectorId),
      userId: viewer.userId,
      userName: displayName(actor),
      description: `${monthLabel(month)} collection target for ${displayName(collector)} set to ₱${args.targetAmount.toLocaleString("en-PH")}${existing ? "" : " (new)"}`,
      oldValues: existing ? { targetAmount: existing.targetAmount } : undefined,
      newValues: { targetAmount: args.targetAmount, month: monthLabel(month) },
      branchId,
      timestamp: setAt,
    });

    return { success: true };
  },
});

/** Clear a collector's target for a month. */
export const clearTarget = mutation({
  args: {
    collectorId: v.id("users"),
    month: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);
    requireTargetManager(viewer.role);

    if (!isAdminRole(viewer.role)) {
      if (!viewer.branchId) {
        throw new Error(
          "Your account is not assigned to a branch yet. Ask Head Office to assign you to one."
        );
      }
      const collector = await ctx.db.get(args.collectorId);
      if (!collector) throw new Error("That collector no longer exists.");
      if (collector.branchId !== viewer.branchId) {
        throw new Error(
          "You can only clear targets for collectors in your branch."
        );
      }
    }

    const month = monthStart(args.month ?? Date.now());
    const existing = await ctx.db
      .query("collector_targets")
      .withIndex("by_collector_month", (q) =>
        q.eq("collectorId", args.collectorId).eq("month", month)
      )
      .first();
    if (!existing) {
      throw new Error("That collector has no target for this month.");
    }

    await ctx.db.delete(existing._id);

    const collector = await ctx.db.get(args.collectorId);
    const actor = await ctx.db.get(viewer.userId);
    await ctx.db.insert("audit_log", {
      action: "delete",
      entityType: "collector_target",
      entityId: String(args.collectorId),
      userId: viewer.userId,
      userName: displayName(actor),
      description: `${monthLabel(month)} collection target for ${displayName(collector)} cleared`,
      oldValues: { targetAmount: existing.targetAmount, month: monthLabel(month) },
      branchId: existing.branchId,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/** Whether the caller may set/clear targets, so the UI can hide the controls. */
export const myAccess = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await assertStaff(ctx);
    return {
      role: viewer.role,
      userId: viewer.userId,
      branchId: viewer.branchId ?? null,
      canManageTargets: canManageTargets(viewer.role),
      isAdmin: isAdminRole(viewer.role),
    };
  },
});