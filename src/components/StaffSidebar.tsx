/**
 * Staff sidebar — a hover-expand rail on desktop and a full-screen slide-in on
 * mobile. Open state lives in one context so the brand lockup, nav links and
 * footer all reveal or hide their labels together.
 *
 * The colour language is the house one (pine gradient, cream active state, gold
 * accents) rather than the neutral greys of a generic dashboard shell.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NavLink, useLocation } from "react-router";
import { X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

export const SIDEBAR_WIDTH = 264;
export const SIDEBAR_RAIL = 68;

interface SidebarContextValue {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider");
  return context;
}

export function SidebarProvider({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: ReactNode;
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  animate?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  children,
  open,
  setOpen,
  animate,
}: {
  children: ReactNode;
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  animate?: boolean;
}) {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
}

/** The rail. Width animates between the label and icon-only sizes on hover. */
export function DesktopSidebar({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.aside>) {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.aside
      className={cn(
        // Sticky so a long page scrolls under the rail instead of dragging it.
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-gradient-to-b from-[#1b4332] to-[#0f2a1d] md:flex",
        className
      )}
      initial={false}
      animate={{ width: animate ? (open ? SIDEBAR_WIDTH : SIDEBAR_RAIL) : SIDEBAR_WIDTH }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.aside>
  );
}

/** Full-screen slide-in for small screens. */
export function MobileSidebar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { open, setOpen } = useSidebar();
  const location = useLocation();

  // Route changes dismiss the panel, so tapping a link lands on the page.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-sidebar"
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
          className={cn(
            "fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-gradient-to-b from-[#1b4332] to-[#0f2a1d] md:hidden",
            className
          )}
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The company lockup: mark plus wordmark when there is room for the wordmark. */
export function SidebarBrand({ subtitle = "Staff Portal" }: { subtitle?: string }) {
  const { open } = useSidebar();
  return (
    <div className="flex min-w-0 items-center gap-3 py-5">
      <BrandLogo className="h-9 w-9 shrink-0 rounded-[9px] ring-1 ring-white/15" />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="wordmark"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            className="flex min-w-0 flex-col leading-tight"
          >
            <span className="font-brand truncate text-[17px] leading-none text-white">
              Evangelist
            </span>
            <span className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
              {subtitle}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SidebarLinkProps {
  to: string;
  label: string;
  icon: ReactNode;
  /** Always show the label, even on the rail (used by the footer actions). */
  alwaysShowLabel?: boolean;
  className?: string;
  onNavigate?: () => void;
}

/** A footer row: icon plus a label that appears with the rail. */
export function SidebarAction({
  label,
  icon,
  onClick,
  className,
  title,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  className?: string;
  title?: string;
}) {
  const { open, animate } = useSidebar();
  const showLabel = open || !animate;
  return (
    <button
      type="button"
      onClick={onClick}
      title={showLabel ? title : label}
      className={cn(
        "flex w-full items-center rounded-full py-2.5 text-[14px] font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white",
        open ? "gap-3 px-4" : "justify-center px-0",
        className
      )}
    >
      <span className="shrink-0">{icon}</span>
      <AnimatePresence initial={false}>
        {showLabel && (
          <motion.span
            key="label"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            className="truncate"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/**
 * One nav row. `to` renders a router link so the active route is tracked by
 * react-router; the label fades and slides in with the rail.
 */
export function SidebarLink({
  to,
  label,
  icon,
  alwaysShowLabel = false,
  className,
  onNavigate,
}: SidebarLinkProps) {
  const { open, animate } = useSidebar();
  const showLabel = open || !animate || alwaysShowLabel;

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={open ? undefined : label}
      className={({ isActive }) =>
        cn(
          "group/link relative flex items-center rounded-full py-2.5 text-[14.5px] font-medium transition-colors",
          open ? "gap-3 px-4" : "justify-center px-0",
          isActive
            ? "bg-cream text-pine shadow-sm"
            : "text-white/65 hover:bg-white/10 hover:text-white",
          className
        )
      }
    >
      {() => (
        <>
          <span className="shrink-0">{icon}</span>
          <AnimatePresence initial={false}>
            {showLabel && (
              <motion.span
                key="label"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.15 }}
                className="truncate"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </>
      )}
    </NavLink>
  );
}
