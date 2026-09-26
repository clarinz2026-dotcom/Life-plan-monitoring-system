import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Navigate, useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  CreditCard,
  LogOut,
  Menu,
  BarChart3,
  History,
  Upload,
  Calculator,
  AlertTriangle,
  Bell,
  BookMarked,
  Link2,
  Moon,
  UserCog,
  Package,
  Building2,
  PanelLeft,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { useBranch } from "@/hooks/use-branch";
import { BranchScopeSelector } from "@/components/BranchScopeSelector";
import {
  DesktopSidebar,
  MobileSidebar,
  Sidebar,
  SidebarAction,
  SidebarBrand,
  SidebarLink,
} from "@/components/StaffSidebar";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  // Every staff account gets its own branch workspace. A Branch Manager uses it
  // to run their branch (roster, settings); Head Office uses it to drill into
  // whichever branch the scope selector points at.
  { to: "/my-branch", icon: Building2, label: "My Branch", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/clients", icon: Users, label: "Clients", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/contracts", icon: FileText, label: "Contracts", roles: ["super_admin", "ceo", "manager", "finance_staff"] },
  { to: "/payments", icon: CreditCard, label: "Payments", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/receipts", icon: Receipt, label: "Receipts", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/plans", icon: Package, label: "Plans", roles: ["super_admin", "ceo"] },
  { to: "/bulk-upload", icon: Upload, label: "Bulk Upload", roles: ["super_admin", "ceo", "manager", "finance_staff"] },
  { to: "/reports", icon: BarChart3, label: "Reports", roles: ["super_admin", "ceo", "manager", "finance_staff"] },

  { to: "/audit", icon: History, label: "Audit Log", roles: ["super_admin", "ceo", "manager"] },
  { to: "/reconciliation", icon: Calculator, label: "Close Register", roles: ["super_admin", "ceo", "manager", "cashier"] },
  // Receipt-book register. Collectors and branch managers see the series held
  // by them; Finance sees the whole company ledger and is one of the roles
  // allowed to assign a new series (see convex/orSeries.ts).
  { to: "/or-series", icon: BookMarked, label: "OR Series", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/aging-report", icon: AlertTriangle, label: "Aging Report", roles: ["super_admin", "ceo", "manager", "finance_staff"] },
  { to: "/account-links", icon: Link2, label: "Account Linking", roles: ["super_admin", "ceo", "manager"] },
  { to: "/notifications", icon: Bell, label: "Notifications", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/branches", icon: Building2, label: "Branches", roles: ["super_admin", "ceo"] },
  { to: "/role-management", icon: UserCog, label: "Roles", roles: ["super_admin", "ceo"] },

];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  ceo: "CEO",
  finance_staff: "Finance Staff",
  cashier: "Cashier",
  manager: "Manager",
};

/** Roles that may use the staff area. Anything else is a client-portal account. */
const STAFF_ROLES = ["super_admin", "ceo", "manager", "finance_staff", "cashier"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const superAdminData = useQuery(api.users.hasSuperAdmin);
  const { branchId, isBranchStaff, isCeoOrAdmin } = useBranch();

  // The signed-in user document, not `hasRole`, is the authority for the role.
  // `hasRole` can still serve the signed-out shape (role: null) for a beat after
  // a fresh sign-in, which used to bounce staff accounts out to the portal.
  const userLoaded = user !== undefined && user !== null;
  const userRole = userLoaded ? user?.role ?? null : null;
  // Fetch only this user's own branch (one document) instead of the full branch
  // list with a manager lookup for every branch on every page load.
  const userBranch = useQuery(
    api.branches.get,
    isBranchStaff && branchId ? { branchId } : "skip"
  );

  // Name of the branch Head Office has selected (skipped entirely for branch
  // staff, who only ever see their own branch).
  const scopeBranch = useQuery(
    api.branches.get,
    isCeoOrAdmin && branchId ? { branchId } : "skip"
  );

  // What the header says the app is currently showing. Head Office either sees
  // the company-wide roll-up or the one branch it selected; branch staff always
  // see their own branch, because that is all the server will return them.
  const scopeLabel = isCeoOrAdmin
    ? branchId
      ? scopeBranch?.name ?? "Loading…"
      : "All Branches"
    : userBranch?.name ?? "Your branch";
  const navigate = useNavigate();
  const location = useLocation();
  // One open state for both surfaces: the desktop rail reveals labels on hover
  // (or stays out while pinned), and the mobile menu button toggles the panel.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [railPinned, setRailPinned] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Never assume a privileged role while the role is still loading — the old
  // `?? "super_admin"` default flashed the full admin nav (and setup link) to
  // cashiers and managers on every page mount.
  const hasSuperAdmin = superAdminData?.hasSuperAdmin ?? false;
  const roleLabel = userRole ? ROLE_LABELS[userRole] || userRole : "";

  const isStaffAccount =
    userLoaded && userRole !== null && STAFF_ROLES.includes(userRole);
  const onSetupPage = location.pathname === "/super-admin-setup";

  // A brand-new install: nobody holds Super Admin yet.
  const canRenderSetupPage =
    onSetupPage && superAdminData !== undefined && !hasSuperAdmin;

  // Redirect to super admin setup if no super admin exists and user isn't one
  const needsSetup = useMemo(() => {
    if (superAdminData === undefined) return false;
    if (hasSuperAdmin) return false;
    if (userRole === "super_admin") return false;
    return true;
  }, [superAdminData, hasSuperAdmin, userRole]);

  useEffect(() => {
    if (needsSetup && location.pathname !== "/super-admin-setup") {
      navigate("/super-admin-setup");
    }
  }, [needsSetup, location.pathname, navigate]);

  // Render page content only once we know the account may see it.
  const canRenderPage = isStaffAccount || canRenderSetupPage;
  // Staff endpoints reject non-staff callers (a planholder account must never
  // read client/payment data). Redirect those accounts to the client portal so
  // the staff pages — and their guarded queries — never mount.
  const firstRun = superAdminData !== undefined && !hasSuperAdmin;
  const mustGoToPortal =
    userLoaded &&
    superAdminData !== undefined &&
    !isStaffAccount &&
    !onSetupPage &&
    // On a brand-new install the setup flow must win — otherwise the first
    // account would be sent to the portal and could never claim Super Admin.
    !firstRun;

  const visibleNav = useMemo(() => {
    // While the role is still loading (null) nothing is shown, so a cashier or
    // manager never briefly sees links they are not allowed to use.
    if (!userRole) return [];
    return NAV_ITEMS.filter((item) => {
      if (!item.roles.includes(userRole)) return false;
      if (item.to === "/super-admin-setup" && hasSuperAdmin) return false;
      return true;
    });
  }, [userRole, hasSuperAdmin]);


  // Early return placed after every hook so the hook order stays stable across
  // renders (React throws when a conditional return changes it).
  if (mustGoToPortal) {
    return <Navigate to="/portal/plans" replace />;
  }

  return (
    <div className="staff-shell flex min-h-screen flex-col bg-background overflow-visible md:flex-row">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        {/* Desktop rail: labels reveal on hover, or stay out when pinned. */}
        <DesktopSidebar>
          <div className="flex min-h-0 flex-1 flex-col px-3">
            <div className="flex items-center gap-2">
              <SidebarBrand />
              <button
                type="button"
                onClick={() => setRailPinned(!railPinned)}
                title={railPinned ? "Unpin sidebar" : "Keep sidebar open"}
                aria-label={railPinned ? "Unpin sidebar" : "Keep sidebar open"}
                aria-pressed={railPinned}
                className={`ml-auto shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/10 hover:text-white ${
                  sidebarOpen ? "block" : "hidden"
                } ${railPinned ? "text-gold-soft" : "text-white/50"}`}
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto pb-3">
              {visibleNav.map((item) => (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={<item.icon className="h-5 w-5" />}
                />
              ))}
            </nav>

            <div className="space-y-1 border-t border-white/10 py-3">
              {sidebarOpen && (
                <div className="px-4 pb-3 pt-1">
                  <p className="truncate text-[13.5px] font-semibold text-white">
                    {user?.name || user?.email || "User"}
                  </p>
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-gold-soft">
                    {roleLabel}
                  </p>
                  {isBranchStaff && userBranch && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">
                      <Building2 className="h-3 w-3 shrink-0 text-gold-soft" />
                      <p className="truncate text-[11px] text-white/75">{userBranch.name}</p>
                    </div>
                  )}
                </div>
              )}
              <SidebarAction
                label={darkMode ? "Light Mode" : "Dark Mode"}
                icon={<Moon className="h-5 w-5" />}
                onClick={() => setDarkMode(!darkMode)}
              />
              <SidebarAction label="Sign out" icon={<LogOut className="h-5 w-5" />} onClick={handleSignOut} />
            </div>
          </div>
        </DesktopSidebar>

        {/* Mobile menu: full-screen panel over the page. */}
        <MobileSidebar>
          <div className="flex min-h-full flex-col px-4 pt-4">
            <div className="px-1">
              <SidebarBrand />
            </div>
            <nav className="flex-1 space-y-1 py-2">
              {visibleNav.map((item) => (
                <SidebarLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={<item.icon className="h-5 w-5" />}
                  className="py-3"
                />
              ))}
            </nav>
            <div className="space-y-1 border-t border-white/10 py-4">
              <div className="px-4 pb-3">
                <p className="truncate text-[13.5px] font-semibold text-white">
                  {user?.name || user?.email || "User"}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-soft">
                  {roleLabel}
                </p>
                <p className="mt-1 text-[11.5px] text-white/60">
                  {isCeoOrAdmin ? "Scope: " : "Branch: "}
                  <span className="text-white/85">{scopeLabel}</span>
                </p>
                {isCeoOrAdmin && (
                  <div className="mt-2.5">
                    <BranchScopeSelector tone="chrome" className="w-full justify-between" />
                  </div>
                )}
              </div>
              <SidebarAction
                label={darkMode ? "Light Mode" : "Dark Mode"}
                icon={<Moon className="h-5 w-5" />}
                onClick={() => setDarkMode(!darkMode)}
                className="py-3"
              />
              <SidebarAction
                label="Sign out"
                icon={<LogOut className="h-5 w-5" />}
                onClick={handleSignOut}
                className="py-3"
              />
            </div>
          </div>
        </MobileSidebar>
      </Sidebar>

      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#1b4332] to-[#0f2a1d] px-4 py-3.5 md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo className="h-8 w-8 shrink-0 rounded-[9px] ring-1 ring-white/15" />
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-brand truncate text-[17px] leading-none text-white">Evangelist</span>
            <span className="hidden max-w-[150px] items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 ring-1 ring-white/10 min-[420px]:inline-flex">
              <Building2 className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                {isCeoOrAdmin ? scopeLabel : userBranch?.name ?? "Your branch"}
              </span>
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-gold-soft min-[380px]:inline">
            {roleLabel}
          </span>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden h-[60px]" />

        {/*
         * Scope bar. States plainly which branch the pages below are showing —
         * "All Branches" with the selector for Head Office, or the branch a
         * staff account is locked to. Branch staff get no selector because
         * their scope is fixed by their account, not by a choice.
         */}
        {canRenderPage && (
          <header className="sticky top-0 z-40 hidden items-center justify-between gap-4 border-b border-line bg-paper/95 px-5 py-3 backdrop-blur md:flex lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isCeoOrAdmin && !branchId
                    ? "bg-evergreen/10 text-evergreen"
                    : "bg-gold/15 text-gold"
                }`}
              >
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone">
                  {isCeoOrAdmin ? "Viewing" : "Your branch"}
                </span>
                <span className="truncate text-[14px] font-semibold text-evergreen">
                  {scopeLabel}
                </span>
              </div>
              {!isCeoOrAdmin && (
                <span className="ml-1 hidden shrink-0 rounded-full bg-evergreen/8 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-evergreen ring-1 ring-evergreen/15 lg:inline">
                  Locked scope
                </span>
              )}
            </div>
            <BranchScopeSelector />
          </header>
        )}

        <main className="mx-auto w-full max-w-[1500px] flex-1 pb-10 md:pb-0">
          {canRenderPage ? children : null}
        </main>
      </div>

    </div>
  );
}
