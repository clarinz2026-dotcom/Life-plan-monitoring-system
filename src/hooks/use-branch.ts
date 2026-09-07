import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Provides the current user's branch context.
 *
 * - CEO / Super Admin: branchId is null (they see all branches)
 * - Branch Manager / Collector / Cashier: branchId is their assigned branch
 *
 * Pass `queryBranchId` to Convex queries that accept it to auto-filter data.
 */
export function useBranch() {
  const roleData = useQuery(api.users.hasRole);

  const role = roleData?.role ?? null;
  const branchId = roleData?.branchId ?? null;

  const isCeoOrAdmin = role === "ceo" || role === "super_admin";
  const isBranchStaff = !isCeoOrAdmin && branchId !== null;
  const isManager = role === "manager" && branchId !== null;

  return {
    role,
    branchId: branchId as Id<"branches"> | null,
    isCeoOrAdmin,
    isBranchStaff,
    isManager,
    /**
     * Returns the branchId to pass to queries.
     * - If CEO/Admin: returns undefined (no filter = all branches)
     * - If branch staff: returns their branchId (filtered view)
     */
    queryBranchId: isCeoOrAdmin ? undefined : branchId ?? undefined,
  };
}
