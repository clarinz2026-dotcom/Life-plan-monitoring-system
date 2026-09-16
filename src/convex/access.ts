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

/** Head Office administrators (the "global access" level). */
export const isHeadOfficeRole = isAdminRole;

/** A branch manager — full control of exactly one branch. */
export const isManagerRole = (role: string | null) => role === "manager";

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
 *
 * This is the single source of truth for data scoping:
 * - Head Office (CEO / Super Admin): may pass any branchId, or none for the
 *   company-wide view. The requested value is honoured, and the UI's branch
 *   selector is only a convenience — passing another branchId is allowed here
 *   *because* the caller is Head Office.
 * - Branch staff (manager / cashier / finance_staff): the requested value is
 *   IGNORED and their own branch is forced. This is what makes tampering with
 *   `branchId` from the browser useless.
 * - Anonymous callers and planholder accounts: rejected.
 *
 * A Convex query is callable by anyone holding the deployment URL, so the
 * unauthenticated case must throw rather than fall through to an unfiltered
 * read. Weakness fixed here: an anonymous caller previously received no filter
 * and therefore every branch's clients, contracts, and payments.
 */
export async function resolveBranchFilter(
  ctx: QueryCtx,
  requested?: Id<"branches">
): Promise<Id<"branches"> | undefined> {
  const viewer = await getViewer(ctx);
  if (!viewer) throw new Error("Not authenticated.");
  if (isAdminRole(viewer.role)) return requested ?? undefined;
  if (!isStaffRole(viewer.role)) {
    throw new Error("Staff access required.");
  }
  // A branch account with no branch would otherwise fall through to an
  // unfiltered read of every branch. Force the caller to be scoped first.
  if (!viewer.branchId) {
    throw new Error(
      "Your account is not assigned to a branch yet. Ask Head Office to assign you to one."
    );
  }
  return viewer.branchId;
}

/**
 * Read guard for a single branch-owned record (client, contract, payment,
 * receipt, document).
 *
 * This is the counterpart to `assertCanAccessRecord` for reads: without it a
 * branch user could open /clients/<another-branch-client-id> directly and read
 * beneficiary and payment data belonging to a different branch.
 *
 * Staff only (planholder accounts and guests are rejected), admins may read any
 * branch, branch staff may read their own. Records that carry no branch yet
 * (legacy rows awaiting backfill) stay readable so a branch never loses access
 * to its own history.
 */
export async function assertRecordVisible(
  ctx: QueryCtx | MutationCtx,
  recordBranchId: Id<"branches"> | undefined | null
): Promise<Viewer> {
  const viewer = await assertStaff(ctx);
  if (isAdminRole(viewer.role)) return viewer;
  if (!recordBranchId || viewer.branchId === recordBranchId) return viewer;
  throw new Error("This record belongs to another branch.");
}

/**
 * Read guard for a branch itself. Admins may read any branch; branch staff may
 * read only the branch they are assigned to.
 */
export async function assertBranchVisible(
  ctx: QueryCtx | MutationCtx,
  branchId: Id<"branches">
): Promise<Viewer> {
  const viewer = await assertStaff(ctx);
  if (isAdminRole(viewer.role)) return viewer;
  if (viewer.branchId === branchId) return viewer;
  throw new Error("This branch is outside your access.");
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

/**
 * Guard for acting on a *branch itself* (settings, staff roster, statistics).
 *
 * Head Office may act on any branch. A manager may act on their own branch
 * only, and a manager with no branch assigned may act on nothing.
 */
export async function assertCanManageBranch(
  ctx: QueryCtx | MutationCtx,
  branchId: Id<"branches">
): Promise<Viewer> {
  const viewer = await assertStaff(ctx);
  if (isAdminRole(viewer.role)) return viewer;
  if (isManagerRole(viewer.role) && viewer.branchId === branchId) return viewer;
  throw new Error("This branch is outside your access.");
}

/**
 * Guard for managing a staff account. `target` is the account being changed.
 *
 * - Head Office: any account except the protected admin roles (enforced by the
 *   caller-specific rules in users.assignBranch).
 * - Manager: only accounts already inside their own branch, and only for
 *   non-admin targets — so a manager can hire/rotate their own team but can
 *   never touch another branch or escalate themselves.
 *
 * `target.branchId` of null means the account has not been placed in a branch
 * yet; a manager may claim such an account into their own branch.
 */
export function assertCanManageStaffAccount(
  viewer: Viewer,
  target: { role?: string | null; position?: string | null; branchId?: Id<"branches"> | null }
): void {
  if (isAdminRole(viewer.role)) return;

  if (!isManagerRole(viewer.role)) {
    throw new Error("Only a Branch Manager or Head Office can manage staff accounts.");
  }
  if (!viewer.branchId) {
    throw new Error("You are not assigned to a branch, so you cannot manage staff.");
  }
  // Never let a manager touch an admin account, or an account in another branch.
  const targetRole = target.role ?? null;
  if (targetRole === "super_admin" || targetRole === "ceo") {
    throw new Error("Only the Super Admin can manage a CEO or Super Admin account.");
  }
  if (target.branchId && target.branchId !== viewer.branchId) {
    throw new Error("That staff member belongs to another branch.");
  }
}