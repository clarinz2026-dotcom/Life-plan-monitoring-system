import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Branch scope.
 *
 * There is ONE application and ONE database; a "branch" is a scope over the
 * data, not a separate system. This module is the client half of that model and
 * mirrors the server helper `convex/access.resolveBranchFilter`:
 *
 * - Head Office (CEO / Super Admin) has global access and can point the whole
 *   app at one branch with the `[ ALL BRANCHES ▼ ]` selector. `null` means the
 *   company-wide view.
 * - Branch staff (manager / cashier / finance_staff) are locked to their own
 *   branch. The selector is not rendered for them and, more importantly, the
 *   server ignores any branchId they submit — see `resolveBranchFilter`.
 *
 * The selection is only a *view* preference. Every query still resolves the
 * caller's real authority on the server, so persisting it to localStorage can
 * never widen anyone's access.
 */

const STORAGE_KEY = "evf.branch-scope";

type BranchScopeValue = {
  /** Branch the app is currently scoped to. `null` = all branches. */
  branchId: Id<"branches"> | null;
  setBranchId: (branchId: Id<"branches"> | null) => void;
};

const BranchScopeContext = createContext<BranchScopeValue | null>(null);

export function BranchScopeProvider({ children }: { children: ReactNode }) {
  const [branchId, setBranchIdState] = useState<Id<"branches"> | null>(null);

  // Restore the last selection after mount. Reading localStorage during the
  // first render would make the server and client markup differ, and framed
  // previews can block storage entirely, so failures are ignored.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setBranchIdState(raw as Id<"branches">);
    } catch {
      /* storage unavailable — start on ALL BRANCHES */
    }
  }, []);

  const setBranchId = useCallback((next: Id<"branches"> | null) => {
    setBranchIdState(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — selection simply won't persist */
    }
  }, []);

  const value = useMemo(
    () => ({ branchId, setBranchId }),
    [branchId, setBranchId]
  );

  return (
    <BranchScopeContext.Provider value={value}>
      {children}
    </BranchScopeContext.Provider>
  );
}

/**
 * Head Office's selected branch. Must be called inside `BranchScopeProvider`
 * (mounted by the protected-route shell in main.tsx).
 */
export function useBranchScope(): BranchScopeValue {
  const ctx = useContext(BranchScopeContext);
  if (!ctx) {
    throw new Error("useBranchScope must be used inside <BranchScopeProvider>");
  }
  return ctx;
}

/**
 * The current viewer's branch context.
 *
 * `queryBranchId` is what you pass to Convex queries:
 * - Head Office: the branch chosen in the selector, or `undefined` for all.
 * - Branch staff: always their own branch (ignored server-side anyway).
 */
export function useBranch() {
  const roleData = useQuery(api.users.hasRole);
  const scope = useContext(BranchScopeContext);

  const role = roleData?.role ?? null;
  // The branch the account is *assigned* to. Head Office is normally assigned
  // to none, which is what grants the company-wide view.
  const ownBranchId = roleData?.branchId ?? null;

  const isCeoOrAdmin = role === "ceo" || role === "super_admin";
  const isBranchStaff = !isCeoOrAdmin && ownBranchId !== null;
  const isManager = role === "manager" && ownBranchId !== null;

  // For Head Office this is the selector's value (a lens on the data); for
  // branch staff it is their own branch and cannot be anything else.
  const branchId = isCeoOrAdmin
    ? (scope?.branchId ?? null)
    : ownBranchId;

  return {
    role,
    branchId: branchId as Id<"branches"> | null,
    /** The account's own assignment (never affected by the selector). */
    ownBranchId: ownBranchId as Id<"branches"> | null,
    isCeoOrAdmin,
    isBranchStaff,
    isManager,
    /** True only for Head Office with no branch selected. */
    isAllBranches: isCeoOrAdmin && branchId === null,
    queryBranchId: isCeoOrAdmin ? branchId ?? undefined : ownBranchId ?? undefined,
  };
}
