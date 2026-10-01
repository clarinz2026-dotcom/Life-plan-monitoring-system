/**
 * Roles vs. positions.
 *
 * Every permission check in the app reads `users.role`. `users.position` is the
 * job title a staff member holds inside their branch (Branch Manager,
 * Collector, Cashier), set from the "Assign Staff to Branch" form.
 *
 * Those two used to drift: the assignment form stored a branch + position but
 * never wrote a role, so a real staff member ended up with
 * `role: undefined` — which every guard (and the sign-in router) reads as
 * "not staff", bouncing them to the client portal.
 *
 * `effectiveRole` is the one place that reconciles the two: an explicit role
 * always wins, and a position still grants the access that goes with it. Use it
 * anywhere a role decides what an account may do.
 */

export type Role =
  | "super_admin"
  | "ceo"
  | "manager"
  | "finance_staff"
  | "cashier"
  | "collector_supervisor";

export type StaffPosition =
  | "branch_manager"
  | "collector"
  | "cashier"
  | "collector_supervisor";

/** Access level granted by each branch position. */
export const ROLE_FROM_POSITION: Record<StaffPosition, Role> = {
  branch_manager: "manager",
  collector: "finance_staff",
  cashier: "cashier",
  collector_supervisor: "collector_supervisor",
};

export function roleFromPosition(
  position?: StaffPosition | null
): Role | null {
  if (!position) return null;
  return ROLE_FROM_POSITION[position] ?? null;
}

/**
 * The role an account is actually treated as having. Returns null for client
 * portal accounts (planholders/families) and anonymous guests.
 */
export function effectiveRole(
  user?: { role?: Role | null; position?: StaffPosition | null } | null
): Role | null {
  if (!user) return null;
  return user.role ?? roleFromPosition(user.position);
}
