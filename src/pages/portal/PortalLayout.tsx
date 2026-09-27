import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FileHeart, Link2, Loader2, LogOut, Phone } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router";

const NAV = [
  { to: "/portal/plans", label: "My Plans", icon: FileHeart, end: false },
  { to: "/portal/link-account", label: "Link Account", icon: Link2, end: false },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold transition-colors ${
    isActive
      ? "bg-evergreen text-white shadow-sm"
      : "text-ink/70 hover:bg-evergreen/8 hover:text-evergreen"
  }`;
}

function mobileClass({ isActive }: { isActive: boolean }) {
  return `flex flex-col items-center gap-1 px-2 pt-2 pb-1.5 text-[11.5px] font-semibold transition-colors rounded-lg ${
    isActive ? "text-evergreen" : "text-stone hover:text-evergreen"
  }`;
}

export default function PortalLayout() {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="portal-shell flex min-h-screen flex-col bg-cream text-ink antialiased">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-3" aria-label="Back to Evangelist website">
            <BrandLogo className="h-9 w-9 rounded-[9px] shadow-sm ring-1 ring-black/10" />
            <span className="hidden leading-tight sm:block">
              <span className="font-brayles block text-[18px] leading-tight text-blue-800">
                Evangelist
              </span>
              <span className="block text-[10.5px] font-medium tracking-[0.16em] text-stone uppercase">
                Client Portal
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Portal">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {user?.role && (
              <a
                href="/dashboard"
                className="hidden items-center gap-1.5 rounded-full border border-evergreen/25 px-3.5 py-2 text-[13px] font-bold text-evergreen transition-colors hover:bg-evergreen hover:text-white sm:inline-flex"
              >
                Staff dashboard
              </a>
            )}
            <a
              href="tel:+63287000000"
              className="hidden items-center gap-1.5 text-[13px] font-semibold text-evergreen md:flex"
            >
              <Phone className="h-3.5 w-3.5 text-gold" />
              24/7 0955 399 1034
            </a>
            <span className="hidden max-w-[150px] truncate text-[13px] text-stone xl:block">
              {user?.name || user?.email || ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={isLoading}
              className="gap-2 rounded-full text-[14px] text-ink/70 hover:text-red-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-32 sm:px-6 lg:py-10 lg:pb-16">
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-md lg:hidden"
        aria-label="Portal (mobile)"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-3 pb-[max(env(safe-area-inset-bottom),6px)]">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={mobileClass}>
              <item.icon className="h-[21px] w-[21px]" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
