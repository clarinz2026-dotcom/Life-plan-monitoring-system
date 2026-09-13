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
  Download,
  FileX,
  Moon,
  UserCog,
  Crown,
  Palette,
  Package,
  Building2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { useBranch } from "@/hooks/use-branch";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/clients", icon: Users, label: "Clients", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/contracts", icon: FileText, label: "Contracts", roles: ["super_admin", "ceo", "manager", "finance_staff"] },
  { to: "/payments", icon: CreditCard, label: "Payments", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/receipts", icon: Receipt, label: "Receipts", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/plans", icon: Package, label: "Plans", roles: ["super_admin", "ceo"] },
  { to: "/bulk-upload", icon: Upload, label: "Bulk Upload", roles: ["super_admin", "ceo", "manager", "finance_staff"] },
  { to: "/reports", icon: BarChart3, label: "Reports", roles: ["super_admin", "ceo", "manager", "finance_staff"] },
  { to: "/audit", icon: History, label: "Audit Log", roles: ["super_admin", "ceo", "manager"] },
  { to: "/reconciliation", icon: Calculator, label: "Reconciliation", roles: ["super_admin", "ceo", "manager", "cashier"] },
  { to: "/death-claims", icon: FileX, label: "Death Claims", roles: ["super_admin", "ceo", "manager", "finance_staff"] },
  { to: "/aging-report", icon: AlertTriangle, label: "Aging Report", roles: ["super_admin", "ceo", "manager", "finance_staff"] },
  { to: "/service-requests", icon: Bell, label: "Service Requests", roles: ["super_admin", "ceo", "manager"] },
  { to: "/notifications", icon: Bell, label: "Notifications", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
  { to: "/export", icon: Download, label: "Export Data", roles: ["super_admin", "ceo", "manager"] },
  { to: "/branches", icon: Building2, label: "Branches", roles: ["super_admin", "ceo"] },
  { to: "/role-management", icon: UserCog, label: "Roles", roles: ["super_admin", "ceo"] },
  { to: "/branding", icon: Palette, label: "Branding", roles: ["super_admin", "ceo"] },
  { to: "/super-admin-setup", icon: Crown, label: "Setup", roles: ["super_admin", "ceo", "manager", "finance_staff", "cashier"] },
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
  const { branchId, isBranchStaff } = useBranch();

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
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background overflow-visible">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div
            className={`flex items-center gap-3 min-w-0 ${
              collapsed ? "flex-1 justify-center px-1" : ""
            }`}
          >
            <BrandLogo className="h-9 w-9 shrink-0 rounded-lg" />
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[15px] text-white truncate">
                  Evangelist Funeral Services
                </span>
                <span className="text-[11px] text-white/50">
                  Management System
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
                `flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                } ${collapsed ? "justify-center" : ""}`
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
              <p className="text-[14px] font-semibold text-white truncate">
                {user?.name || user?.email || "User"}
              </p>
              <p className="text-[12px] text-white/50">
                {roleLabel}
              </p>
              {isBranchStaff && userBranch && (
                <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1">
                  <Building2 className="h-3 w-3 text-white/60" />
                  <p className="text-[11px] text-white/70 truncate">
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

      {/* Mobile top bar */}        <div className="md:hidden fixed top-0 left-0 right-0 z-[99999] flex items-center justify-between border-b border-border bg-sidebar px-4 py-3.5">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-8 w-8 rounded-lg" />
          <div>
            <span className="font-bold text-[15px] text-white">Evangelist</span>
            {isBranchStaff && userBranch && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                <Building2 className="h-2.5 w-2.5" />
                {userBranch.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-white/60">{roleLabel}</span>
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
          <div className="absolute top-[60px] left-0 right-0 bg-sidebar border-b border-sidebar-border shadow-xl overflow-y-auto max-h-[calc(100vh-60px-64px)]">
            <nav className="py-3 px-3">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] font-medium transition-colors ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-white/70 hover:bg-white/10"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <div className="border-t border-sidebar-border mt-2 pt-2">
                <div className="px-4 py-3">
                  <p className="text-[14px] font-semibold text-white truncate">
                    {user?.name || user?.email || "User"}
                  </p>
                  <p className="text-[12px] text-white/50">{roleLabel}</p>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="flex items-center gap-3 w-full rounded-lg px-4 py-3 text-[15px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Moon className="h-5 w-5" />
                  <span>{darkMode ? "Light" : "Dark"} Mode</span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full rounded-lg px-4 py-3 text-[15px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
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
        <main className="flex-1 pb-20 md:pb-0">
          {canRenderPage ? children : null}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-sidebar">
        <div className="flex items-center justify-around py-2 px-1">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg min-w-0 transition-colors ${
                  isActive
                    ? "text-green-400"
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
