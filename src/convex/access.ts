import { getAuthUserId } from "@convex-dev/auth/server";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { effectiveRole } from "./roles";

/**
 * Branch access helpers shared across staff endpoints.
 *
 * Model (mirrors src/hooks/use-branch.ts on the client):
 * - CEO / Super Admin: full visibility and full write access (all branches).
 * - Branch staff (manager / cashier / finance_staff): isolated to their
 *   assigned branch — reads are forced to it, writes must match it.
 * - Records with no branchId (legacy/unassigned data) are admin-only to
 *   modify; use `branches.assignToBranch` to backfill them.
 */

export type Viewer = {
  userId: Id<"users">;
  role: string | null;
  branchId: Id<"branches"> | null | undefined;
};

export async function getViewer(
  ctx: QueryCtx | MutationCtx
): Promise<Viewer | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const doc = await ctx.db.get(userId);
  if (!doc) return null;
  // A branch position counts as staff even when no explicit role was written
  // (the "Assign Staff to Branch" flow sets position only).
  return { userId, role: effectiveRole(doc), branchId: doc.branchId };
}

export const isAdminRole = (role: string | null) =>
  role === "super_admin" || role === "ceo";

/** Roles that belong to office staff (i.e. may read business records). */
export const STAFF_ROLES = [
  "super_admin",
  "ceo",
  "manager",
  "finance_staff",
  "cashier",
] as const;

export const isStaffRole = (role: string | null) =>
  !!role && (STAFF_ROLES as readonly string[]).includes(role);

/**
 * Require the caller to be signed in as office staff.
 *
 * Client-portal accounts (planholders/families) and anonymous callers must not
 * reach staff-only endpoints such as the audit trail, death claims, payment
 * schedules, or notification workers.
 */
export async function assertStaff(
  ctx: QueryCtx | MutationCtx
): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (!viewer) throw new Error("Not authenticated.");
  if (!isStaffRole(viewer.role)) throw new Error("Staff access required.");
  return viewer;
}

/**
 * Resolve the effective branch filter for a staff list query.
 * Branch staff are always forced to their own branch (server-side isolation);
 * admins may pass any branchId (undefined = all branches). Anonymous callers
 * get no filter (staff pages are authed anyway, and public queries such as the
 * client portal use their own endpoints).
 */
export async function resolveBranchFilter(
  ctx: QueryCtx,
  requested?: Id<"branches">
): Promise<Id<"branches"> | undefined> {
  const viewer = await getViewer(ctx);
  if (!viewer || isAdminRole(viewer.role)) return requested ?? undefined;
  // A signed-in account that is not office staff (for example a planholder
  // account created from the public sign-up form) must never be able to read
  // client, contract, or payment data. Previously such accounts received *no*
  // filter, which returned every branch's records.
  if (!isStaffRole(viewer.role)) {
    throw new Error("Staff access required.");
  }
  return viewer.branchId ?? undefined;
}

/**
 * Require the caller to be signed in and (unless CEO/Super Admin) assigned to
 * the same branch as the record being written. Throws otherwise.
 *
 * `recordBranchId` of undefined/null means the record is unassigned (legacy
 * data) — only admins may modify those until they are backfilled to a branch.
 */
export async function assertCanAccessRecord(
  ctx: MutationCtx,
  recordBranchId: Id<"branches"> | undefined | null
): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (!viewer) throw new Error("Not authenticated.");
  if (isAdminRole(viewer.role)) return viewer;
  if (recordBranchId && viewer.branchId === recordBranchId) return viewer;
  throw new Error(
    "You can only manage records from your assigned branch. Unassigned records must be assigned to a branch by the CEO or Super Admin first."
  );
}