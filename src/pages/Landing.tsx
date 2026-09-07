import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  Apple,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Box,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Coffee,
  Compass,
  Download,
  Facebook,
  FileHeart,
  Flame,
  HeartHandshake,
  Instagram,
  Landmark,
  Mail,
  MapPin,
  Menu,
  Phone,
  Play,
  Quote,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  ThumbsUp,
  Users,
  Video,
  X,
  Youtube,
} from "lucide-react";

const MOTTO = "To Care And To Serve!";
const COMPANY = "Evangelist Funeral Services";

const U = "https://images.unsplash.com/";
const img = (id: string, w = 1600) =>
  `${U}photo-${id}?q=80&w=${w}&auto=format&fit=crop`;

const HERO_LIFE_IMG = img("1470071459604-3b5ec3a7fe05", 1800);
const HERO_CHAPEL_IMG = img("1519167758481-83f550bb49b3", 1800);
const STORY_IMG = img("1470252649378-9c29740c9fa8", 1200);
const STORY_IMG_2 = img("1495616811223-4d98c6e9c869", 800);
const CHAPEL_DETAIL_IMG = img("1452860606245-08befc0ff44b", 1400);
const EBUROL_IMG = img("1519681393784-d120267933ba", 1400);
const MEADOW_IMG = img("1502082553048-f009c37129b9", 1000);

/* ────────────────────────────────────────────────────────────────────────────
   Data
──────────────────────────────────────────────────────────────────────────── */

type Leaf = { label: string; href?: string };
type MegaCol = { title: string; items: Leaf[] };

const LIFE_PLAN_COLS: MegaCol[] = [
  {
    title: "The Company",
    items: [
      { label: "About Evangelist Life Plans", href: "#about" },
      { label: "Officers & Management" },
      { label: "Corporate Governance" },
      { label: "News & Announcements" },
    ],
  },
  {
    title: "Plans & Products",
    items: [
      { label: "Traditional Memorial Plan", href: "#life-plans" },
      { label: "Family & Paired Plan", href: "#life-plans" },
      { label: "Cremation Life Plan", href: "#life-plans" },
      { label: "Memorial Lot & Interment" },
    ],
  },
  {
    title: "For Families",
    items: [
      { label: "Grief Resources" },
      { label: "Bereavement Support" },
      { label: "Aftercare Program" },
      { label: "Gallery" },
    ],
  },
  {
    title: "eServices",
    items: [
      { label: "eBurol — Online Wake Viewing", href: "#eservices" },
      { label: "Virtual Tour", href: "#eservices" },
      { label: "Store Locator", href: "#eservices" },
      { label: "Online Store & e-Payment", href: "#eservices" },
    ],
  },
];

const CHAPELS_COLS: MegaCol[] = [
  {
    title: "About the Chapels",
    items: [
      { label: "About Our Chapels", href: "#chapels" },
      { label: "Officers & Staff" },
      { label: "Facilities", href: "#chapels" },
      { label: "Gallery" },
    ],
  },
  {
    title: "Memorial Services",
    items: [
      { label: "Wake & Viewing Services" },
      { label: "Funeral Rites & Processions" },
      { label: "Casket Types", href: "#caskets" },
      { label: "Urns & Memorial Keepsakes", href: "#caskets" },
    ],
  },
  {
    title: "Chapel Amenities",
    items: [
      { label: "Viewing Halls & Chapels", href: "#chapels" },
      { label: "Family Lounges" },
      { label: "Catering & Hospitality" },
      { label: "Parking & Accessibility" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "CSR & Community Programs" },
      { label: "Careers" },
      { label: "Contact Us", href: "#contact" },
    ],
  },
];

const SEALS = [
  {
    mark: "ICCFA",
    name: "International Cemetery, Cremation & Funeral Association",
  },
  { mark: "NFDA", name: "National Funeral Directors Association" },
  { mark: "CANA", name: "Cremation Association of North America" },
];

const QUICK_ITEMS: {
  icon: typeof FileHeart;
  label: string;
  href?: string;
  note: string;
}[] = [
  { icon: FileHeart, label: "Life Plans", href: "#life-plans", note: "Pre-need memorial plans" },
  { icon: Video, label: "eBurol", href: "#eservices", note: "Online wake viewing" },
  { icon: Compass, label: "Virtual Tour", href: "#eservices", note: "Tour our chapels online" },
  { icon: MapPin, label: "Store Locator", href: "#eservices", note: "Find a chapel near you" },
  { icon: ThumbsUp, label: "Facebook", note: "Like our page" },
  { icon: ShoppingCart, label: "Buy Now", note: "Shop plans & memorial items" },
];

/* ────────────────────────────────────────────────────────────────────────────
   Small shared bits
──────────────────────────────────────────────────────────────────────────── */

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease: [0.22, 0.61, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p
      className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] ${
        light ? "text-gold-soft" : "text-gold"
      }`}
    >
      <span className="h-px w-8 bg-current" />
      {children}
    </p>
  );
}

function NavLeaf({ leaf }: { leaf: Leaf }) {
  return (
    <a
      href={leaf.href ?? undefined}
      onClick={(e) => {
        if (!leaf.href) e.preventDefault();
      }}
      className="group/leaf flex items-baseline gap-2 py-2 text-[14px] leading-snug text-ink/75 transition-colors hover:text-evergreen"
    >
      <span className="text-[10px] text-gold opacity-0 transition-opacity group-hover/leaf:opacity-100">
        ◆
      </span>
      <span>{leaf.label}</span>
    </a>
  );
}

function MegaColumn({ col }: { col: MegaCol }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold mb-3">
        {col.title}
      </p>
      <div className="flex flex-col">
        {col.items.map((leaf) => (
          <NavLeaf key={leaf.label} leaf={leaf} />
        ))}
      </div>
    </div>
  );
}

function BrandBlock({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandLogo className="h-10 w-10 rounded-[10px] shadow-sm ring-1 ring-black/10" />
      <div className="leading-none">
        <p
          className={`font-bold uppercase tracking-[0.14em] ${
            light ? "text-white" : "text-evergreen"
          }`}
          style={{ fontSize: "15px" }}
        >
          Evangelist
        </p>
        <p
          className={`mt-1 text-[10.5px] font-medium uppercase tracking-[0.2em] ${
            light ? "text-white/55" : "text-stone"
          }`}
        >
          Funeral Services
        </p>
      </div>
    </div>
  );
}

function StoreBadge({ store }: { store: "apple" | "google" }) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-xl bg-[#101419] px-4 py-2.5 text-left text-white ring-1 ring-black/20 transition-all hover:-translate-y-0.5 hover:shadow-xl"
    >
      {store === "apple" ? (
        <Apple className="h-6 w-6 fill-white" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
          <path d="M7.1 3.2c-.5-.3-1.1 0-1.2.5v16.6c.1.5.7.8 1.2.5l14-8.3c.4-.3.4-.9 0-1.2l-14-8.1z" />
        </svg>
      )}
      <span className="leading-tight">
        <span className="block text-[10px] uppercase tracking-wider text-white/60">
          {store === "apple" ? "Download on the" : "Get it on"}
        </span>
        <span className="block text-[15px] font-semibold">
          {store === "apple" ? "App Store" : "Google Play"}
        </span>
      </span>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Quick-access floating hamburger (sticky, collapsible)
──────────────────────────────────────────────────────────────────────────── */

function QuickAccessFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-5 bottom-5 z-[80] flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-[264px] overflow-hidden rounded-2xl border border-line bg-white/95 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-line bg-cream px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-evergreen">
                Quick Access
              </p>
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            </div>
            <div className="p-2">
              {QUICK_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href ?? undefined}
                  onClick={(e) => {
                    if (!item.href) e.preventDefault();
                    setOpen(false);
                  }}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-evergreen/5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-evergreen/8 text-evergreen transition-colors group-hover:bg-evergreen group-hover:text-white">
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13.5px] font-semibold text-ink">
                      {item.label}
                    </span>
                    <span className="block text-[11px] text-stone">{item.note}</span>
                  </span>
                  {item.href && (
                    <ArrowUpRight className="ml-auto h-4 w-4 text-gold opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label={open ? "Close quick access menu" : "Open quick access menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-14 w-14 place-items-center rounded-full text-white shadow-2xl ring-4 ring-white/70 transition-all duration-300 ${
          open ? "rotate-180 bg-gold" : "bg-evergreen hover:bg-moss"
        }`}
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Desktop header w/ mega-dropdowns + mobile drawer
──────────────────────────────────────────────────────────────────────────── */

const NAV_MENUS = [
  { key: "life", label: "Life Plan", cols: LIFE_PLAN_COLS, id: "#life-plans" },
  { key: "chapels", label: "Chapels", cols: CHAPELS_COLS, id: "#chapels" },
] as const;

function NavHeader() {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  // Close menus on Escape and lock body scroll while the mobile drawer is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setDrawer(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  return (
    <>
      {/* ── Utility strip ── */}
      <div className="hidden border-b border-white/10 bg-pine text-white/80 lg:block">
        <div className="mx-auto flex h-9 max-w-[1440px] items-center justify-between px-6 xl:px-10">
          <p className="flex items-center gap-2 text-[11.5px] font-medium tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-soft" />
            {MOTTO} — serving families with dignity and care.
          </p>
          <div className="flex items-center gap-5 text-[11.5px]">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-gold-soft" />
              24/7 Hotline: (088) 500-0000
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-gold-soft" />
              Mon–Sat, 8:00 AM – 5:00 PM
            </span>
            <span className="flex items-center gap-1.5 truncate max-w-[260px]">
              <MapPin className="h-3 w-3 text-gold-soft" />
              Main Office: 2nd Floor, Gabrinez Bldg, Fortich St., Malaybalay City, Bukidnon 8700
            </span>
          </div>
        </div>
      </div>

      {/* ── Main bar ── */}
      <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 xl:px-10">
          <BrandBlock />

          {/* Desktop category nav */}
          <nav className="hidden items-center lg:flex" aria-label="Primary">
            {NAV_MENUS.map((menu) => {
              const open = openMenu === menu.key;
              return (
                <div
                  key={menu.key}
                  className="relative"
                  onMouseEnter={() => setOpenMenu(menu.key)}
                  onMouseLeave={() => setOpenMenu((v) => (v === menu.key ? null : v))}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenMenu(open ? null : menu.key)}
                    className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[15px] font-bold uppercase tracking-[0.14em] transition-colors ${
                      open ? "bg-evergreen text-white" : "text-ink hover:text-evergreen"
                    }`}
                  >
                    {menu.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-300 ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Mega panel */}
                  <div
                    className={`absolute left-1/2 top-full z-50 w-[900px] -translate-x-1/2 pt-3 transition-all duration-200 ${
                      open
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-1 opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
                      <div className="grid grid-cols-4 gap-8 px-9 py-8">
                        {menu.cols.map((col) => (
                          <MegaColumn key={col.title} col={col} />
                        ))}
                      </div>
                      <a
                        href={menu.id}
                        onClick={() => setOpenMenu(null)}
                        className="group flex items-center justify-between bg-cream px-9 py-3.5 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-evergreen transition-colors hover:bg-evergreen hover:text-white"
                      >
                        View {menu.label} offerings
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="hidden h-10 rounded-full border-evergreen/25 px-5 text-[13.5px] font-semibold text-evergreen hover:bg-evergreen/5 sm:inline-flex"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="grid h-11 w-11 place-items-center rounded-full text-evergreen lg:hidden"
              aria-label="Open menu"
              onClick={() => setDrawer(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {drawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] lg:hidden"
          >
            <div
              className="absolute inset-0 bg-pine/60 backdrop-blur-sm"
              onClick={() => setDrawer(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col overflow-y-auto bg-paper shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-5 py-4 backdrop-blur">
                <BrandBlock />
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Close menu"
                  onClick={() => setDrawer(false)}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <nav className="flex-1 px-5 py-6" aria-label="Mobile">
                {NAV_MENUS.map((menu) => (
                  <div key={menu.key} className="mb-7">
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.26em] text-gold">
                      <span className="h-px w-6 bg-current" />
                      {menu.label}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-y-0.5">
                      {menu.cols
                        .flatMap((c) => c.items)
                        .map((leaf) => (
                          <a
                            key={`${menu.key}-${leaf.label}`}
                            href={leaf.href ?? undefined}
                            onClick={(e) => {
                              if (!leaf.href) e.preventDefault();
                              setDrawer(false);
                            }}
                            className="flex items-center justify-between rounded-xl px-2 py-2.5 text-[15px] font-medium text-ink/80 transition-colors hover:bg-evergreen/5 hover:text-evergreen"
                          >
                            {leaf.label}
                            <ChevronRight className="h-4 w-4 text-stone/60" />
                          </a>
                        ))}
                    </div>
                  </div>
                ))}

                <div className="border-t border-line pt-6">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.26em] text-gold">
                    <span className="h-px w-6 bg-current" />
                    Quick Access
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-1">
                    {QUICK_ITEMS.map((item) => (
                      <a
                        key={item.label}
                        href={item.href ?? undefined}
                        onClick={(e) => {
                          if (!item.href) e.preventDefault();
                          setDrawer(false);
                        }}
                        className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-[15px] font-medium text-ink/80 transition-colors hover:bg-evergreen/5 hover:text-evergreen"
                      >
                        <item.icon className="h-[18px] w-[18px] text-evergreen" />
                        {item.label}
                        <span className="ml-auto text-xs text-stone">{item.note}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </nav>

              <div className="border-t border-line p-5">
                <Button
                  className="h-12 w-full rounded-full text-[15px]"
                  onClick={() => {
                    setDrawer(false);
                    navigate("/auth");
                  }}
                >
                  Sign in to the Portal
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────────────────────── */

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">
      <NavHeader />

      {/* ════════════════════════════════════════════════════════════════
          HERO — two big offerings
      ════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <Reveal>
          <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-stone">
            A family-owned DeathCare company · Pre-Need Memorial Plans & Memorial
            Chapels
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
          {/* ── Life Plan tile ── */}
          <motion.figure
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
            className="group relative isolate flex min-h-[440px] items-end overflow-hidden rounded-[30px] shadow-xl lg:min-h-[600px]"
          >
            <img
              src={HERO_LIFE_IMG}
              alt="Morning light over rolling hills — hope and peace for a family's future"
              className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-[1800ms] ease-out group-hover:scale-[1.06]"
              loading="eager"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
            <figcaption className="w-full p-8 pb-10 sm:p-10 lg:p-14">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-soft backdrop-blur-sm">
                Division 01 · Pre-Need Plans
              </span>
              <h1 className="mt-5 font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Life Plan
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
                Affordable, traditional pre-need memorial plans that let you secure
                your family’s future today — with guaranteed service, flexible
                terms, and the peace of mind that comes from planning ahead.
              </p>
              <a
                href="#life-plans"
                className="group/link mt-7 inline-flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.2em] text-gold-soft transition-colors hover:text-white"
              >
                Learn more about our Life Plans
                <span className="grid h-8 w-8 place-items-center rounded-full border border-gold-soft/60 transition-all group-hover/link:translate-x-1 group-hover/link:bg-white group-hover/link:text-evergreen">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            </figcaption>
          </motion.figure>

          {/* ── Chapels tile ── */}
          <motion.figure
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 0.61, 0.36, 1] }}
            className="group relative isolate flex min-h-[440px] items-end overflow-hidden rounded-[30px] shadow-xl lg:min-h-[600px]"
          >
            <img
              src={HERO_CHAPEL_IMG}
              alt="Inside one of our dignified memorial chapels lit by warm light"
              className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-[1800ms] ease-out group-hover:scale-[1.06]"
              loading="eager"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
            <figcaption className="w-full p-8 pb-10 sm:p-10 lg:p-14">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-soft backdrop-blur-sm">
                Division 02 · Memorial Services
              </span>
              <h2 className="mt-5 font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Chapels
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
                Dignified, professionally staffed memorial chapels open 24/7 —
                quiet viewing halls, modern amenities, and compassionate service
                for every family we are entrusted to serve.
              </p>
              <a
                href="#chapels"
                className="group/link mt-7 inline-flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.2em] text-gold-soft transition-colors hover:text-white"
              >
                Know more about our Chapels
                <span className="grid h-8 w-8 place-items-center rounded-full border border-gold-soft/60 transition-all group-hover/link:translate-x-1 group-hover/link:bg-white group-hover/link:text-evergreen">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            </figcaption>
          </motion.figure>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          AFFILIATIONS / TRUST BADGES
      ════════════════════════════════════════════════════════════════ */}
      <section className="mt-10 border-y border-line bg-cream lg:mt-16">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-8 px-6 py-10 lg:flex-row lg:px-10 lg:py-12">
          <Reveal className="max-w-md text-center lg:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold">
              Affiliations
            </p>
            <p className="mt-2 font-display text-[26px] leading-snug text-evergreen">
              Members of the world’s leading deathcare associations
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-stone">
              Our standards are guided by internationally recognized industry
              organizations — so families can trust the way we care.
            </p>
          </Reveal>

          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {SEALS.map((seal, i) => (
              <Reveal key={seal.mark} delay={i * 0.1}>
                <div className="group flex items-center gap-4">
                  <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full border-[1.5px] border-evergreen/50 transition-colors group-hover:border-gold">
                    <div className="absolute inset-[5px] rounded-full border border-gold/40" />
                    <span className="font-display text-[19px] font-bold tracking-wide text-evergreen">
                      {seal.mark}
                    </span>
                  </div>
                  <p className="max-w-[220px] text-[11.5px] leading-snug text-stone">
                    {seal.name}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          STORY
      ════════════════════════════════════════════════════════════════ */}
      <section id="about" className="mx-auto max-w-[1440px] scroll-mt-24 px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <Eyebrow>Who we are</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.12] tracking-tight text-evergreen lg:text-[52px]">
              Care that begins long
              <br />
              before the day you need it.
            </h2>
            <p className="mt-6 text-[15.5px] leading-relaxed text-stone">
              {COMPANY} is a family-run DeathCare company whose work is guided by a
              simple promise — <em className="text-evergreen">{MOTTO}</em>. Through
              our pre-need Life Plans and our network of memorial chapels, we help
              Filipino families prepare for life’s most difficult moments with
              dignity, transparency, and genuine compassion.
            </p>
            <p className="mt-4 text-[15.5px] leading-relaxed text-stone">
              Every plan is backed by an accredited service commitment. Every
              chapel is staffed by professionals who treat each wake, each
              memorial, and each family as if it were their own.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                { icon: HeartHandshake, t: "Compassion" },
                { icon: ShieldCheck, t: "Guaranteed service" },
                { icon: Sparkles, t: "Affordable plans" },
              ].map((c) => (
                <span
                  key={c.t}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[12.5px] font-semibold text-evergreen"
                >
                  <c.icon className="h-4 w-4 text-gold" />
                  {c.t}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.15} className="relative">
            <div className="overflow-hidden rounded-[30px] shadow-2xl">
              <img
                src={STORY_IMG}
                alt="A quiet path leading toward morning light"
                className="aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-8 -left-4 hidden w-[230px] overflow-hidden rounded-2xl border-[6px] border-paper shadow-xl sm:block lg:-left-10">
              <img
                src={STORY_IMG_2}
                alt="White memorial flowers"
                className="h-40 w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="absolute -top-5 -right-3 flex items-center gap-3 rounded-2xl bg-evergreen px-5 py-4 text-white shadow-2xl sm:right-6">
              <Quote className="h-5 w-5 text-gold-soft" />
              <p className="font-display text-[15px] italic leading-snug">“{MOTTO}”</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Motto banner ── */}
      <section className="relative overflow-hidden bg-evergreen">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 30%, rgba(216,196,156,.5), transparent 42%), radial-gradient(circle at 82% 72%, rgba(216,196,156,.4), transparent 40%)",
          }}
        />
        <Reveal className="relative mx-auto max-w-4xl px-6 py-14 text-center lg:py-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold-soft">
            Our corporate motto
          </p>
          <p className="mt-4 font-display text-3xl font-medium italic leading-snug text-white lg:text-[40px]">
            “{MOTTO}”
          </p>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/70">
            Everything we do — every plan we offer and every service we render —
            begins and ends with this promise to the families who trust us.
          </p>
        </Reveal>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          LIFE PLANS & PRODUCT TYPES
      ════════════════════════════════════════════════════════════════ */}
      <section id="life-plans" className="scroll-mt-24 border-b border-line bg-cream">
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10 lg:py-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <Reveal>
              <Eyebrow>Life Plan · Division 01</Eyebrow>
              <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1.12] tracking-tight text-evergreen lg:text-[46px]">
                A pre-need plan for every family
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="max-w-sm text-[14px] leading-relaxed text-stone">
                Affordable monthly terms, price protection, and service you can
                rely on — because your family’s future should never be left to
                chance.
              </p>
            </Reveal>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: FileHeart,
                title: "Traditional Memorial Plan",
                desc: "Our flagship pre-need plan covers a complete traditional memorial service — wake, chapel use, funeral rites, and procession — for one insured member.",
                perks: ["Guaranteed service at time of need", "Easy monthly installments", "Locked-in plan price"],
              },
              {
                icon: Users,
                title: "Family & Paired Plan",
                desc: "One plan, two insured members. A cost-efficient way to protect both spouses — or a parent and child — under a single affordable package.",
                perks: ["Covers two insured members", "Lower per-member cost", "Transferable benefits"],
              },
              {
                icon: Flame,
                title: "Cremation Life Plan",
                desc: "A modern, dignified alternative. Complete cremation arrangements, memorial service support, and keepsake options at clearly stated prices.",
                perks: ["Complete cremation services", "Urn & memorial options", "Flexible payment terms"],
              },
            ].map((plan, i) => (
              <Reveal key={plan.title} delay={i * 0.1}>
                <article className="group flex h-full flex-col rounded-3xl border border-line bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
                  <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-evergreen/8 text-evergreen transition-colors duration-300 group-hover:bg-evergreen group-hover:text-white">
                    <plan.icon className="h-7 w-7" />
                  </div>
                  <h3 className="font-display text-[23px] font-semibold text-ink">
                    {plan.title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-stone">
                    {plan.desc}
                  </p>
                  <ul className="mt-5 space-y-2">
                    {plan.perks.map((p) => (
                      <li
                        key={p}
                        className="flex items-center gap-2.5 text-[13px] font-medium text-ink/75"
                      >
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                          <Check className="h-3 w-3" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-auto inline-flex items-center gap-1.5 pt-6 text-[12px] font-bold uppercase tracking-[0.18em] text-evergreen transition-colors hover:text-gold"
                  >
                    Learn more about this plan
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </article>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          CHAPELS & FACILITIES
      ════════════════════════════════════════════════════════════════ */}
      <section id="chapels" className="mx-auto max-w-[1440px] scroll-mt-24 px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
          <Reveal className="relative order-2 lg:order-1">
            <div className="overflow-hidden rounded-[30px] shadow-2xl">
              <img
                src={CHAPEL_DETAIL_IMG}
                alt="A serene, well-kept memorial chapel interior"
                className="aspect-[4/4.4] w-full object-cover transition-transform duration-700 hover:scale-[1.03] lg:aspect-[4/5]"
                loading="lazy"
              />
            </div>
            <div className="absolute right-5 -bottom-7 flex items-center gap-3 rounded-2xl bg-pine px-6 py-5 text-white shadow-2xl">
              <Clock className="h-8 w-8 text-gold-soft" />
              <div className="leading-tight">
                <p className="font-display text-xl font-semibold">Open 24/7</p>
                <p className="text-[11.5px] text-white/65">Chapels, embalming & support</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="order-1 lg:order-2">
            <Eyebrow>Chapels · Division 02</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.12] tracking-tight text-evergreen lg:text-[46px]">
              A dignified setting
              <br />
              for every remembrance
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-stone">
              Our memorial chapels combine quiet, prayerful spaces with the modern
              conveniences today’s families expect — professionally run from the
              first phone call to the final farewell.
            </p>

            <div className="mt-9 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {[
                { icon: Landmark, t: "Memorial chapels & viewing halls" },
                { icon: Video, t: "eBurol-equipped wake rooms" },
                { icon: Box, t: "Casket & urn showrooms" },
                { icon: Car, t: "Hearse & processional services" },
                { icon: Coffee, t: "Family lounges & light catering" },
                { icon: Users, t: "Embalming & bereavement staff" },
              ].map((f) => (
                <div key={f.t} className="flex items-start gap-3.5">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-evergreen/8 text-evergreen">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <p className="pt-2 text-[14px] font-semibold leading-snug text-ink/85">
                    {f.t}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Casket types */}
        <Reveal className="mt-20">
          <div
            id="caskets"
            className="scroll-mt-28 rounded-[28px] border border-line bg-cream px-7 py-9 lg:px-12"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-lg">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold">
                  Memorial products
                </p>
                <h3 className="mt-2 font-display text-[30px] font-semibold leading-tight text-evergreen">
                  Casket types & memorial keepsakes
                </h3>
              </div>
              <p className="max-w-sm text-[13.5px] leading-relaxed text-stone">
                Every casket we offer is chosen for quality, dignity, and honesty
                in pricing — view them in person at any of our chapels.
              </p>
            </div>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {[
                "Wooden Classics",
                "Metal Series",
                "Designer Series",
                "Fibreglass Collection",
                "Baby & Child Caskets",
                "Urns & Memorial Keepsakes",
                "Memorial Floral Packages",
              ].map((c) => (
                <span
                  key={c}
                  className="cursor-default rounded-full border border-evergreen/20 bg-white px-4 py-2 text-[12.5px] font-semibold text-evergreen transition-colors hover:border-gold hover:bg-gold/10"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          eSERVICES — eBurol, virtual tour, locator, online store
      ════════════════════════════════════════════════════════════════ */}
      <section id="eservices" className="scroll-mt-24 overflow-hidden bg-pine">
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            {/* copy + cards */}
            <div>
              <Reveal>
                <Eyebrow light>eServices · Care beyond distance</Eyebrow>
                <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.12] tracking-tight text-white lg:text-[46px]">
                  Stay close to the ones
                  <br />
                  you love — even from afar
                </h2>
                <p className="mt-5 max-w-xl text-[14.5px] leading-relaxed text-white/65">
                  Distance should never keep a family from being together. Our
                  digital services bring the chapel experience to your phone,
                  wherever in the world you may be.
                </p>
              </Reveal>

              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { icon: Video, t: "eBurol", d: "The first online, 24/7 real-time viewing of wakes held in our chapels." },
                  { icon: Compass, t: "Virtual Tour", d: "Walk through our chapels and facilities from the comfort of your home." },
                  { icon: MapPin, t: "Store Locator", d: "Find the chapel, office, or accredited agent nearest you." },
                  { icon: ShoppingCart, t: "Online Store", d: "Buy plans and memorial items online — pay via GCash, Maya, or card." },
                ].map((s, i) => (
                  <Reveal key={s.t} delay={i * 0.08}>
                    <div className="group h-full rounded-2xl border border-white/12 bg-white/[0.05] p-6 backdrop-blur-sm transition-colors duration-300 hover:border-gold-soft/50 hover:bg-white/[0.09]">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/20 text-gold-soft">
                        <s.icon className="h-[22px] w-[22px]" />
                      </span>
                      <h3 className="mt-4 text-[17px] font-bold text-white">{s.t}</h3>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/60">
                        {s.d}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* eBurol live visual */}
            <Reveal delay={0.15}>
              <div className="relative mx-auto max-w-[520px]">
                <div className="overflow-hidden rounded-[26px] border border-white/15 shadow-2xl">
                  <div className="flex items-center justify-between bg-[#0c1a12] px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/85">
                        eBurol · Live
                      </p>
                    </div>
                    <p className="text-[11px] font-medium text-white/50">
                      Wake Room 02 · Camera 1
                    </p>
                  </div>
                  <div className="relative">
                    <img
                      src={EBUROL_IMG}
                      alt="eBurol live online wake viewing stream"
                      className="aspect-[16/10] w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 py-4">
                      <p className="text-[12px] font-semibold text-white">
                        Streaming now — 2,140 family members watching with you
                      </p>
                    </div>
                    <span className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm">
                      <Video className="h-4 w-4" />
                    </span>
                  </div>
                </div>
                <div className="absolute -top-5 -left-5 hidden items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-pine shadow-xl sm:flex">
                  <Play className="h-3.5 w-3.5 fill-pine" />
                  The 1st online wake viewing in the country
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          APP DOWNLOAD
      ════════════════════════════════════════════════════════════════ */}
      <section id="app" className="scroll-mt-24 border-b border-line bg-cream">
        <div className="mx-auto grid max-w-[1440px] items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:px-10 lg:py-28">
          <div>
            <Reveal>
              <Eyebrow>Download our app</Eyebrow>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.12] tracking-tight text-evergreen lg:text-[46px]">
                The Evangelist app —
                <br />
                care at your fingertips
              </h2>
              <ul className="mt-8 space-y-4">
                {[
                  { t: "Watch wakes live through eBurol", d: "Be present at the wake from anywhere in the world, in real time." },
                  { t: "Manage your plan & payments", d: "View payment history, pay installments, and request official receipts." },
                  { t: "Locate chapels & take virtual tours", d: "Explore our facilities and find the nearest chapel in one tap." },
                  { t: "Grief resources & aftercare", d: "Guides, contacts, and support whenever a family needs a helping hand." },
                ].map((f) => (
                  <li key={f.t} className="flex items-start gap-4">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-evergreen text-white">
                      <Check className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[15px] font-bold text-ink">{f.t}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-stone">{f.d}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <StoreBadge store="apple" />
                <StoreBadge store="google" />
              </div>
              <p className="mt-4 flex items-center gap-2 text-[12px] font-medium text-stone">
                <Download className="h-3.5 w-3.5 text-gold" />
                Free to download · Available for iOS and Android
              </p>
            </Reveal>
          </div>

          {/* Phone mock */}
          <Reveal delay={0.15} className="relative mx-auto w-full max-w-[420px]">
            <div className="rounded-[42px] border-[10px] border-[#101419] bg-paper shadow-2xl">
              <div className="space-y-3 rounded-[32px] bg-gradient-to-b from-cream to-paper p-5 pb-7">
                <div className="flex items-center justify-between">
                  <BrandBlock />
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-evergreen text-white">
                    <Bell className="h-4 w-4" />
                  </span>
                </div>
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
                  Today
                </p>
                <div className="overflow-hidden rounded-2xl border border-line bg-pine">
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white">
                      eBurol Live · Wake Room 02
                    </p>
                  </div>
                  <img
                    src={MEADOW_IMG}
                    alt="Live wake view in the Evangelist app"
                    className="aspect-[16/8] w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { t: "My Plan", sub: "Active" },
                    { t: "Next Due", sub: "Sep 15" },
                    { t: "Balance", sub: "₱ 4,800" },
                  ].map((s) => (
                    <div key={s.t} className="rounded-xl border border-line bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone">
                        {s.t}
                      </p>
                      <p className="mt-1 text-[15px] font-bold text-evergreen">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
                  <div>
                    <p className="text-[11px] font-bold text-ink">Next installment</p>
                    <p className="text-[10.5px] text-stone">Pay via GCash, Maya, bank or cash</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-evergreen text-white">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute -right-6 -bottom-6 hidden -rotate-3 rounded-2xl border border-line bg-white px-5 py-4 shadow-2xl sm:block">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/15 text-gold">
                  <HeartHandshake className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <p className="text-[12.5px] font-bold text-ink">Family first, always.</p>
                  <p className="text-[11px] text-stone">{MOTTO}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          PORTAL CTA
      ════════════════════════════════════════════════════════════════ */}
      <section className="bg-paper">
        <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-10 lg:py-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-[30px] bg-evergreen px-8 py-12 text-center shadow-2xl lg:px-16 lg:py-16">
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 12% 20%, rgba(216,196,156,.55), transparent 40%), radial-gradient(circle at 88% 85%, rgba(216,196,156,.4), transparent 45%)",
                }}
              />
              <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold-soft">
                  Planholders, families & agents
                </p>
                <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight text-white lg:text-[40px]">
                  Your plan, our services — all in one place
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/70">
                  Track your Life Plan, view schedules and official receipts, book
                  chapels, eBurol and cremations, locate branches, and reach our
                  24/7 team — all from your client portal.
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                  <Button
                    className="h-12 rounded-full bg-paper px-8 text-[15px] font-bold text-evergreen hover:bg-white"
                    onClick={() => navigate("/auth?returnTo=%2Fportal")}
                  >
                    Open my client portal
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-full border-white/30 bg-transparent px-7 text-[14px] font-bold text-white hover:bg-white/10 hover:text-white"
                    onClick={() => navigate("/auth")}
                  >
                    Staff & agents — sign in
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════════ */}
      <footer id="contact" className="scroll-mt-24 bg-pine text-white/70">
        <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-8 lg:px-10">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
            {/* Company */}
            <div>
              <BrandBlock light />
              <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-white/55">
                A family-owned DeathCare company offering pre-need memorial life
                plans and 24/7 memorial chapel services, guided by our promise —
                {MOTTO}.
              </p>
              <div className="mt-6 flex gap-3">
                {[
                  { icon: Facebook, label: "Facebook" },
                  { icon: Instagram, label: "Instagram" },
                  { icon: Youtube, label: "YouTube" },
                ].map((s) => (
                  <a
                    key={s.label}
                    href="#contact"
                    aria-label={s.label}
                    onClick={(e) => e.preventDefault()}
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/70 transition-all hover:border-gold-soft hover:bg-gold hover:text-pine"
                  >
                    <s.icon className="h-[18px] w-[18px]" />
                  </a>
                ))}
              </div>
              <div className="mt-7">
                <div className="flex items-start gap-3.5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-gold-soft ring-1 ring-white/10">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-white">DTI Trust Mark</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/50">
                      Registered online business — a trusted, verified merchant.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-gold-soft">
                Reach us
              </p>
              <ul className="mt-5 space-y-4 text-[13px] leading-relaxed">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
                  <span>
                    Head Office & Flagship Chapel
                    <br />
                    88 Evangelist Ave., Brgy. Old City,
                    <br />
                    Metro Manila, Philippines
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
                  <span>
                    <span className="text-white">24/7 Hotline:</span> (02) 8-700-0000
                    <br />
                    Globe: 0917 000 0000 · Smart: 0918 000 0000
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
                  <span>care@evangelistfuneral.com</span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
                  <span>
                    Office hours: Mon–Sat, 8:00 AM – 5:00 PM
                    <br />
                    Chapels open 24/7, including holidays
                  </span>
                </li>
              </ul>
            </div>

            {/* Explore */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-gold-soft">
                Explore
              </p>
              <ul className="mt-5 space-y-3 text-[13px]">
                {[
                  { label: "Life Plans", href: "#life-plans" },
                  { label: "Chapels & Facilities", href: "#chapels" },
                  { label: "eBurol — Online Wake Viewing", href: "#eservices" },
                  { label: "Virtual Tour", href: "#eservices" },
                  { label: "Store Locator", href: "#eservices" },
                  { label: "Online Store — Buy Now", href: "#eservices" },
                  { label: "Download the App", href: "#app" },
                  { label: "About Us", href: "#about" },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="inline-flex items-center gap-2 transition-colors hover:text-gold-soft"
                    >
                      <span className="h-1 w-1 rounded-full bg-gold-soft/60" />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal + app badges */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-gold-soft">
                Policies & Support
              </p>
              <ul className="mt-5 space-y-3 text-[13px]">
                {[
                  "Privacy Policy",
                  "Terms of Use",
                  "Data Privacy Notice",
                  "Fair Collection Notice",
                  "FAQs & Grief Resources",
                  "Careers",
                ].map((l) => (
                  <li key={l}>
                    <a
                      href="#contact"
                      onClick={(e) => e.preventDefault()}
                      className="inline-flex items-center gap-2 transition-colors hover:text-gold-soft"
                    >
                      <span className="h-1 w-1 rounded-full bg-gold-soft/60" />
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
                  Get the app
                </p>
                <div className="mt-3 flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
                  <StoreBadge store="apple" />
                  <StoreBadge store="google" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 text-[12px] text-white/45 lg:flex-row">
            <p>
              © 2026 {COMPANY}, Inc. All rights reserved. · Pre-Need DeathCare Plan
              Management
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {["Privacy Policy", "Terms of Use", "Data Privacy", "Accessibility"].map(
                (l) => (
                  <a
                    key={l}
                    href="#contact"
                    onClick={(e) => e.preventDefault()}
                    className="transition-colors hover:text-gold-soft"
                  >
                    {l}
                  </a>
                )
              )}
            </div>
          </div>
        </div>
      </footer>

      <QuickAccessFab />
    </div>
  );
}
