import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a branch.
 */
export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    address: v.string(),
    city: v.string(),
    province: v.string(),
    contactNumber: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const branchId = await ctx.db.insert("branches", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });

    return { branchId };
  },
});

/**
 * Main office branch (authoritative address).
 *
 * 2nd Floor, Gabrinez Bldg
 * Fortich St.
 * Malaybalay City, Bukidnon 8700
 * Philippines
 */
export const MAIN_OFFICE = {
  name: "Evangelist Funeral Services — Main Office",
  code: "MBS-001",
  address: "2nd Floor, Gabrinez Building",
  city: "Malaybalay City",
  province: "Bukidnon",
  contactNumber: "(02) 8-700-0000",
  managerId: null,
} as const;

/**
 * List all branches.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const branches = await ctx.db.query("branches").collect();

    const enriched = await Promise.all(
      branches.map(async (b) => {
        const manager = b.managerId ? await ctx.db.get(b.managerId) : null;
        return {
          ...b,
          managerName: manager?.name || manager?.email || null,
        };
      })
    );

    return enriched;
  },
});

/**
 * Update a branch.
 */
export const update = mutation({
  args: {
    branchId: v.id("branches"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    province: v.optional(v.string()),
    contactNumber: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { branchId, ...updates } = args;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(clean).length === 0) return;

    await ctx.db.patch(branchId, clean);
    return { success: true };
  },
});

/**
 * Get a single branch.
 */
export const get = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.branchId);
  },
});
