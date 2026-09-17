import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { roleValidator } from "./schema";
import { effectiveRole, roleFromPosition } from "./roles";
import {
  assertCanManageStaffAccount,
  assertStaff,
  getViewer,
  isAdminRole,
  isManagerRole,
} from "./access";
import { mutation, query, QueryCtx } from "./_generated/server";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    // Report the effective role so the client router and the server guards
    // agree even when access comes from a branch position (see ./roles).
    return { ...user, role: effectiveRole(user) ?? undefined };
  },
});

/**
 * Check if the current user has a specific role.
 */
export const hasRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const role = effectiveRole(user);
    return {
      isSuperAdmin: role === "super_admin",
      isCeo: role === "ceo",
      isManager: role === "manager",
      isFinance: role === "finance_staff",
      isCashier: role === "cashier",
      role,
      branchId: user?.branchId ?? null,
    };
  },
});

/**
 * List all users (for role management). Super Admin and CEO can use this.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) return [];
    const currentUserDoc = await ctx.db.get(currentUserId);
    if (
      !currentUserDoc ||
      (currentUserDoc.role !== "super_admin" && currentUserDoc.role !== "ceo")
    )
      return [];

    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: effectiveRole(u),
      branchId: u.branchId ?? null,
      position: u.position ?? null,
      phoneNumber: u.phoneNumber ?? null,
      createdAt: u._creationTime,
    }));
  },
});

/**
 * Claim super_admin role. Can only be called once — if a super_admin already exists, it fails.
 * This is the one-time setup for the app owner.
 */
/**
 * Claim super admin role. 
 * - First time: locks the email permanently and assigns role.
 * - Same email re-login: re-assigns role (e.g. if accidentally removed).
 * - Different email: permanently blocked.
 */
export const claimSuperAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");

    const userEmail = (user.email ?? "").toLowerCase().trim();
    if (!userEmail) throw new Error("Your account must have an email to claim Super Admin.");

    // Check if super admin email is already locked
    const lockedSetting = await ctx.db
      .query("system_settings")
      .withIndex("by_key", (q) => q.eq("key", "super_admin_email"))
      .first();

    if (lockedSetting) {
      // A super admin email is already locked
      if (lockedSetting.value === userEmail) {
        // Same person re-logging in — re-assign role
        const currentRole = user.role;
        if (currentRole !== "super_admin") {
          await ctx.db.patch(userId, { role: "super_admin" });
          await ctx.db.insert("audit_log", {
            action: "status_change",
            entityType: "client",
            entityId: userId,
            userId: userId,
            userName: user.name ?? user.email ?? "Unknown",
            description: `Super Admin role restored for ${user.name ?? user.email} (email match)`,
            oldValues: { role: currentRole },
            newValues: { role: "super_admin" },
            timestamp: Date.now(),
          });
        }
        return { success: true, restored: currentRole !== "super_admin" };
      } else {
        // Different email — permanently blocked
        throw new Error(
          `This system already has a Super Admin (${lockedSetting.value}). Only that email can hold Super Admin.`
        );
      }
    }

    // No super admin locked yet — this is the first claim
    await ctx.db.patch(userId, { role: "super_admin" });

    // Permanently lock the email
    await ctx.db.insert("system_settings", {
      key: "super_admin_email",
      value: userEmail,
      lockedAt: Date.now(),
      lockedBy: userId,
    });

    // Audit log
    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "client",
      entityId: userId,
      userId: userId,
      userName: user.name ?? user.email ?? "Unknown",
      description: `Super Admin claimed by ${user.name ?? user.email} — email permanently locked`,
      timestamp: Date.now(),
    });

    return { success: true, locked: true };
  },
});

/**
 * Set a user's role.
 *
 * Permission rules:
 * - Super Admin: can assign any role EXCEPT "super_admin" (only one Super Admin
 *   exists and it is locked to the owner's email). Cannot change their own role.
 * - CEO: can assign Manager, Finance Staff, Cashier, and Collector roles.
 *   CANNOT assign "ceo" or "super_admin", and cannot modify users who already
 *   hold those roles. Cannot change their own role.
 * - Everyone else: denied.
 */
/**
 * Set a staff member's mobile number (used for SMS blasts).
 * Head Office only, same trust level as assigning roles.
 */
export const setPhoneNumber = mutation({
  args: {
    userId: v.id("users"),
    phoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    const currentUserDoc = await ctx.db.get(currentUserId);
    const viewerRole = currentUserDoc?.role;
    if (viewerRole !== "super_admin" && viewerRole !== "ceo") {
      throw new Error("Only the Super Admin or CEO can edit staff contact details.");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found.");

    const phone = args.phoneNumber?.trim() || undefined;
    await ctx.db.patch(args.userId, { phoneNumber: phone });

    const actor = await ctx.db.get(currentUserId);
    await ctx.db.insert("audit_log", {
      action: "update",
      entityType: "client", // reuse as system event (matches role-change audits)
      entityId: args.userId,
      userId: currentUserId,
      userName: actor?.name || actor?.email || "Unknown",
      description: `Mobile number ${phone ? `set to ${phone}` : "removed"} for ${targetUser.name || targetUser.email || "user"}`,
      timestamp: Date.now(),
    });
  },
});

export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    const currentUserDoc = await ctx.db.get(currentUserId);
    const viewerRole = currentUserDoc?.role;
    if (viewerRole !== "super_admin" && viewerRole !== "ceo") {
      throw new Error("Only the Super Admin or CEO can assign roles.");
    }

    // Prevent changing your own role
    if (args.userId === currentUserId) {
      throw new Error("You cannot change your own role.");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found.");

    const targetRole = targetUser.role;

    if (viewerRole === "super_admin") {
      if (args.role === "super_admin") {
        throw new Error(
          "Super Admin is locked to the owner's email — it cannot be assigned to anyone else."
        );
      }
    } else {
      // Viewer is CEO
      if (targetRole === "super_admin" || targetRole === "ceo") {
        throw new Error(
          "Only the Super Admin can manage the CEO or Super Admin account."
        );
      }
      if (args.role === "super_admin" || args.role === "ceo") {
        throw new Error(
          "Only the Super Admin can assign the CEO or Super Admin role."
        );
      }
    }

    const oldRole = targetUser.role;
    await ctx.db.patch(args.userId, { role: args.role });

    // Audit log
    await ctx.db.insert("audit_log", {
      action: "status_change",
      entityType: "client", // reuse as system event
      entityId: args.userId,
      userId: currentUserId,
      userName: (currentUserDoc?.name ?? currentUserDoc?.email) || "Unknown",
      description: `Role changed for ${targetUser.name ?? targetUser.email}: ${oldRole ?? "none"} → ${args.role} (by ${viewerRole})`,
      oldValues: { role: oldRole },
      newValues: { role: args.role },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Change the locked super admin email (Super Admin only).
 * This lets you reassign super admin to a different email.
 */
export const changeSuperAdminEmail = mutation({
  args: {
    newEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "super_admin") {
      throw new Error("Only the current Super Admin can change the super admin email.");
    }

    const newEmail = args.newEmail.toLowerCase().trim();
    if (!newEmail) throw new Error("New email is required.");

    // Find the current locked setting
    const lockedSetting = await ctx.db
      .query("system_settings")
      .withIndex("by_key", (q) => q.eq("key", "super_admin_email"))
      .first();

    if (lockedSetting) {
      await ctx.db.patch(lockedSetting._id, { value: newEmail });
    } else {
      await ctx.db.insert("system_settings", {
        key: "super_admin_email",
        value: newEmail,
        lockedAt: Date.now(),
        lockedBy: userId,
      });
    }

    await ctx.db.insert("audit_log", {
      action: "status_change",
      entityType: "client",
      entityId: userId,
      userId: userId,
      userName: user.name ?? user.email ?? "Unknown",
      description: `Super Admin email changed from ${lockedSetting?.value ?? "(none)"} to ${newEmail}`,
      oldValues: { superAdminEmail: lockedSetting?.value },
      newValues: { superAdminEmail: newEmail },
      timestamp: Date.now(),
    });

    return { success: true, newEmail };
  },
});

/**
 * Check if a super_admin exists in the system.
 */
export const hasSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const lockedSetting = await ctx.db
      .query("system_settings")
      .withIndex("by_key", (q) => q.eq("key", "super_admin_email"))
      .first();
    return {
      hasSuperAdmin: lockedSetting !== null,
      superAdminEmail: lockedSetting?.value ?? null,
    };
  },
});

/**
 * Internal helper to get the current user.
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
};

/**
 * Assign a user to a branch with a position.
 *
 * Head Office may place anyone in any branch. A Branch Manager may staff their
 * OWN branch only — they can bring in an unassigned account or rotate a
 * position inside their team, and can never move anybody into or out of another
 * branch, touch a CEO/Super Admin, or change their own branch assignment.
 *
 * The branch is always re-derived from the authenticated account on the server;
 * a branchId submitted by the browser is validated, never trusted.
 */
export const assignBranch = mutation({
  args: {
    userId: v.id("users"),
    branchId: v.optional(v.id("branches")),
    position: v.optional(v.union(
      v.literal("branch_manager"),
      v.literal("collector"),
      v.literal("cashier"),
    )),
  },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx);
    if (!viewer) throw new Error("Not authenticated");
    const currentUserId = viewer.userId;
    const currentUserDoc = await ctx.db.get(currentUserId);
    const viewerRole = viewer.role;
    const viewerIsAdmin = isAdminRole(viewerRole);

    if (!viewerIsAdmin && !isManagerRole(viewerRole)) {
      throw new Error(
        "Only the Super Admin, CEO, or a Branch Manager can assign branches."
      );
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found.");

    if (!viewerIsAdmin) {
      // Manager path — scope enforced here and re-checked below.
      assertCanManageStaffAccount(viewer, targetUser);
      if (args.userId === currentUserId) {
        throw new Error("You cannot change your own branch assignment.");
      }
      if (!viewer.branchId) {
        throw new Error("You are not assigned to a branch yet.");
      }
      if (args.branchId !== viewer.branchId) {
        throw new Error(
          "You can only add staff to your own branch."
        );
      }
    }

    // A branch assignment must point at a real, active branch.
    if (args.branchId !== undefined) {
      const branch = await ctx.db.get(args.branchId);
      if (!branch) throw new Error("Branch not found.");
      if (!branch.isActive) {
        throw new Error(`"${branch.name}" is inactive, so staff cannot be assigned to it.`);
      }
    }

    const oldBranchId = targetUser.branchId;
    const oldPosition = targetUser.position;
    const patch: Record<string, unknown> = {};
    if (args.branchId !== undefined) patch.branchId = args.branchId;
    else patch.branchId = undefined;
    if (args.position !== undefined) {
      patch.position = args.position;
      // Keep the permission role in step with the job title. Assigning a staff
      // member without writing a role left them with `role: undefined`, which
      // every guard reads as "not staff" — so they were bounced to the client
      // portal instead of their branch dashboard.
      const derivedRole = roleFromPosition(args.position);
      // Never downgrade an admin: giving the CEO/Super Admin a branch position
      // must not replace their system role.
      if (derivedRole && !isAdminRole(targetUser.role ?? null)) {
        patch.role = derivedRole;
      }
    } else {
      patch.position = undefined;
    }
    await ctx.db.patch(args.userId, patch);

    // Audit log
    const positionLabel = args.position === "branch_manager" ? "Branch Manager" : args.position === "collector" ? "Collector" : args.position === "cashier" ? "Cashier" : "none";
    await ctx.db.insert("audit_log", {
      action: "status_change",
      entityType: "client",
      entityId: args.userId,
      userId: currentUserId,
      userName: (currentUserDoc?.name ?? currentUserDoc?.email) || "Unknown",
      description: `Branch & position assigned for ${targetUser.name ?? targetUser.email}: ${args.branchId ?? "no branch"} / ${positionLabel} (by ${viewerRole})`,
      oldValues: { branchId: oldBranchId ?? null, position: oldPosition ?? null },
      newValues: { branchId: args.branchId ?? null, position: args.position ?? null },
      // A staff change belongs to the branch it affects, so the trail shows up
      // in that branch's history (Head Office sees every branch's).
      branchId: args.branchId ?? oldBranchId ?? undefined,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * The staff roster of one branch.
 *
 * Head Office may pass any branch; branch staff always get their own (the
 * requested value is ignored). This is what the Branch Manager's "My Branch"
 * page lists, and it deliberately exposes no other branch's people.
 */
export const branchTeam = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const viewer = await assertStaff(ctx);

    const branchId = isAdminRole(viewer.role)
      ? args.branchId ?? viewer.branchId ?? null
      : viewer.branchId ?? null;

    if (!branchId) {
      if (isAdminRole(viewer.role)) {
        // Head Office with no branch chosen: show nothing rather than everyone.
        return [];
      }
      throw new Error("You are not assigned to a branch yet.");
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_branch", (q) => q.eq("branchId", branchId))
      .collect();

    const positionLabel = (p?: string | null) =>
      p === "branch_manager"
        ? "Branch Manager"
        : p === "collector"
          ? "Collector"
          : p === "cashier"
            ? "Cashier"
            : null;

    return users
      .map((u) => ({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        image: u.image ?? null,
        role: effectiveRole(u),
        position: u.position ?? null,
        positionLabel: positionLabel(u.position),
        isAnonymous: u.isAnonymous ?? false,
        joinedAt: u._creationTime,
      }))
      .sort((a, b) => a.joinedAt - b.joinedAt);
  },
});

/**
 * Accounts that are signed in but not yet placed in a branch.
 *
 * Head Office uses this to staff a new branch; a Branch Manager uses it to
 * claim one of their own new hires. Only the branch's manager gets this list,
 * and only for accounts that hold no branch, so it can never reveal another
 * branch's staff.
 */
export const unassignedStaff = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await assertStaff(ctx);
    if (!isAdminRole(viewer.role) && !isManagerRole(viewer.role)) return [];

    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !u.branchId && !(u.isAnonymous ?? false))
      .map((u) => ({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        role: effectiveRole(u),
      }));
  },
});

/**
 * List all users with branch info (for role/branch management).
 */
export const listWithBranches = query({
  args: {},
  handler: async (ctx) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) return [];
    const currentUserDoc = await ctx.db.get(currentUserId);
    if (
      !currentUserDoc ||
      (currentUserDoc.role !== "super_admin" && currentUserDoc.role !== "ceo")
    )
      return [];

    const users = await ctx.db.query("users").collect();
    // Resolve branch names in one pass instead of one db.get per user.
    const branches = await ctx.db.query("branches").collect();
    const branchNameById = new Map(branches.map((b) => [b._id, b.name]));
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: effectiveRole(u),
      branchId: u.branchId ?? null,
      branchName: (u.branchId && branchNameById.get(u.branchId)) || null,
      position: u.position ?? null,
      phoneNumber: u.phoneNumber ?? null,
      createdAt: u._creationTime,
    }));
  },
});
