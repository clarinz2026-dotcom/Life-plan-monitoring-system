import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { roleValidator } from "./schema";
import { mutation, query, QueryCtx } from "./_generated/server";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    return user;
  },
});

/**
 * Check if the current user has a specific role.
 */
export const hasRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user)
      return {
        isSuperAdmin: false,
        isCeo: false,
        isManager: false,
        isFinance: false,
        isCashier: false,
        isCollector: false,
        role: null,
      };
    return {
      isSuperAdmin: user.role === "super_admin",
      isCeo: user.role === "ceo",
      isManager: user.role === "manager",
      isFinance: user.role === "finance_staff",
      isCashier: user.role === "cashier",
      isCollector: user.role === "collector",
      role: user.role ?? null,
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
      role: u.role ?? null,
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
