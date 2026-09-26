import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { NavLink, Navigate, useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
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
  Crown,
  Package,
  Building2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { useBranch } from "@/hooks/use-branch";
import { BranchScopeSelector } from "@/components/BranchScopeSelector";

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
  { to: "/reconciliation", icon: Calculator, label: "Reconciliation", roles: ["super_admin", "ceo", "manager", "cashier"] },
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
  const { branchId, isBranchStaff, isCeoOrAdmin, isAllBranches } = useBranch();

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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  const bottomNavItems = visibleNav.slice(0, 5);

  // Early return placed after every hook so the hook order stays stable across
  // renders (React throws when a conditional return changes it).
  if (mustGoToPortal) {
    return <Navigate to="/portal/plans" replace />;
  }

  return (
    <div className="staff-shell flex min-h-screen flex-col bg-background overflow-visible md:flex-row">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-sidebar-border bg-gradient-to-b from-[#1b4332] to-[#0f2a1d] transition-all duration-200 md:flex ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {/* Header — same lockup as the client portal header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div
            className={`flex items-center gap-3 min-w-0 ${
              collapsed ? "flex-1 justify-center px-1" : ""
            }`}
          >
            <BrandLogo className="h-9 w-9 shrink-0 rounded-[9px] ring-1 ring-white/15" />
            {!collapsed && (
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-bold uppercase tracking-[0.12em] text-white">
                  Evangelist
                </span>
                <span className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
                  Staff Portal
                </span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 shrink-0 text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-full px-4 py-2.5 text-[14.5px] font-medium transition-colors ${
                  isActive
                    ? "bg-cream text-pine shadow-sm"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
                } ${collapsed ? "justify-center px-0" : ""}`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border px-4 py-4">
          {!collapsed && (
            <div className="mb-3 min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-white">
                {user?.name || user?.email || "User"}
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-gold-soft">
                {roleLabel}
              </p>
              {isBranchStaff && userBranch && (
                <div className="mt-2 flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">
                  <Building2 className="h-3 w-3 text-gold-soft" />
                  <p className="text-[11px] text-white/75 truncate">
                    {userBranch.name}
                  </p>
                </div>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-white/60 hover:text-white hover:bg-white/10 justify-start gap-3 py-2.5"
            onClick={() => setDarkMode(!darkMode)}
          >
            <Moon className="h-5 w-5" />
            {!collapsed && <span className="text-[14px]">{darkMode ? "Light" : "Dark"} Mode</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`w-full text-white/60 hover:text-white hover:bg-white/10 justify-start gap-3 py-2.5 ${
              collapsed ? "px-0 justify-center" : ""
            }`}
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="text-[14px]">Sign out</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-[99999] flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#1b4332] to-[#0f2a1d] px-4 py-3.5 md:hidden">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-8 w-8 rounded-[9px] ring-1 ring-white/15" />
          <div>
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-white">Evangelist</span>
            <span className="ml-2 inline-flex max-w-[150px] items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 ring-1 ring-white/10">
              <Building2 className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                {isCeoOrAdmin ? scopeLabel : userBranch?.name ?? "Your branch"}
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-soft">{roleLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-white/70 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[99990]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute top-[60px] left-0 right-0 overflow-y-auto border-b border-white/10 bg-gradient-to-b from-[#1b4332] to-[#0f2a1d] shadow-xl max-h-[calc(100vh-60px-64px)]">
            <nav className="py-3 px-3">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-full px-4 py-3 text-[14.5px] font-medium transition-colors ${
                      isActive
                        ? "bg-cream text-pine"
                        : "text-white/65 hover:bg-white/10"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <div className="border-t border-white/10 mt-2 pt-2">
                <div className="px-4 py-3">
                  <p className="text-[13.5px] font-semibold text-white truncate">
                    {user?.name || user?.email || "User"}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-soft">{roleLabel}</p>
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
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="flex items-center gap-3 w-full rounded-full px-4 py-3 text-[15px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Moon className="h-5 w-5" />
                  <span>{darkMode ? "Light" : "Dark"} Mode</span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full rounded-full px-4 py-3 text-[15px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign out</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

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

        <main className="mx-auto w-full max-w-[1500px] flex-1 pb-20 md:pb-0">
          {canRenderPage ? children : null}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-gradient-to-r from-[#1b4332] to-[#0f2a1d] md:hidden">
        <div className="flex items-center justify-around py-2 px-1">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-full min-w-0 transition-colors ${
                  isActive
                    ? "text-gold-soft"
                    : "text-white/60"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[11px] font-medium truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
