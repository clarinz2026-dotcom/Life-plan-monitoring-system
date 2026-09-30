import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Facebook,
  FileHeart,
  FileText,
  Instagram,
  LayoutDashboard,
  LineChart,
  Link2,
  Mail,
  MapPin,
  Menu,
  Phone,
  Receipt,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
  X,
  Youtube,
} from "lucide-react";

const MOTTO = "To Care And To Serve!";
const COMPANY = "Evangelist Funeral Services";

const U = "https://images.unsplash.com/";
const img = (id: string, w = 1600) =>
  `${U}photo-${id}?q=80&w=${w}&auto=format&fit=crop`;

const imgSet = (id: string, widths: number[] = [640, 960, 1280, 1800]) =>
  widths
    .map((w) => `${U}photo-${id}?q=80&w=${w}&auto=format&fit=crop ${w}w`)
    .join(", ");

const responsive = (id: string, fallbackWidth = 1200) => ({
  src: img(id, fallbackWidth),
  srcSet: imgSet(id),
});

const PORTAL_IMG = responsive("1470252649378-9c29740c9fa8", 1200);
const STAFF_IMG = responsive("1452860606245-08befc0ff44b", 1200);
const LEDGER_IMG = responsive("1554224155-6726b3ff858f", 1200);
const RECORDS_IMG = responsive("1495616811223-4d98c6e9c869", 1200);
const MONITOR_IMG = responsive("1551288049-bebda4e38f71", 1200);

/* ── Primitives ─────────────────────────────────────────────────────────── */

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

function Eyebrow({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
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

function BrandBlock({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandLogo className="h-10 w-10 rounded-[10px] shadow-sm ring-1 ring-black/10" />
      <div className="leading-none">
        <p
          className={`font-brayles text-[23px] leading-none ${
            light ? "text-blue-200" : "text-blue-800"
          }`}
        >
          Evangelist
        </p>
        <p
          className={`font-brayles mt-1 text-[14px] leading-tight ${
            light ? "text-blue-200" : "text-blue-800"
          }`}
        >
          Funeral Services
        </p>
      </div>
    </div>
  );
}

/* ── Navigation ─────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { label: "Client portal", href: "#client-portal" },
  { label: "Staff portal", href: "#staff-portal" },
  { label: "Client management", href: "#clients" },
  { label: "Payment monitoring", href: "#payments" },
];

function NavHeader() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <a href="#top" className="shrink-0">
          <BrandBlock />
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-[13.5px] font-semibold text-ink/70 transition-colors hover:bg-evergreen/8 hover:text-evergreen"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="hidden h-10 rounded-full border-evergreen/25 px-5 text-[13.5px] font-bold text-evergreen hover:bg-evergreen hover:text-white sm:inline-flex"
            onClick={() => navigate("/auth?as=staff")}
          >
            Staff sign in
          </Button>
          <Button
            className="h-10 rounded-full px-5 text-[13.5px] font-bold"
            onClick={() => navigate("/auth?returnTo=%2Fportal")}
          >
            Client portal
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-full border border-line text-evergreen lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-paper px-4 py-3 lg:hidden">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-3 text-[14px] font-semibold text-ink/80 hover:bg-cream"
            >
              {l.label}
              <ChevronDown className="h-4 w-4 -rotate-90 text-gold" />
            </a>
          ))}
          <button
            type="button"
            onClick={() => navigate("/auth?as=staff")}
            className="mt-2 flex w-full items-center justify-between rounded-xl bg-evergreen/8 px-3 py-3 text-[14px] font-bold text-evergreen"
          >
            Staff sign in
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}

/* ── Content ────────────────────────────────────────────────────────────── */

const PILLARS = [
  {
    icon: FileHeart,
    title: "Client portal",
    blurb:
      "Planholders sign in with their email and immediately see the same numbers our office sees.",
    points: [
      "Plan value, total paid, and outstanding balance",
      "Payment history with installment number and running balance",
      "Statement of Account they can print or download as PDF",
      "Account linking request when their email isn't on file yet",
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Staff portal",
    blurb:
      "One workspace for the whole records team — role-aware, and branch-aware out of the box.",
    points: [
      "Dashboard of contracts needing attention",
      "Clients, contracts, payments, and receipts",
      "Daily cashier reconciliation with variance tracking",
      "Multi-branch: the CEO sees everything, staff see their branch",
    ],
  },
  {
    icon: Users,
    title: "Client management",
    blurb:
      "Every planholder record with their beneficiaries, contact details, and plan history.",
    points: [
      "Up to four beneficiaries per planholder record",
      "Search by name or contact number, filter by status",
      "Full audit trail of who changed what, and when",
      "Bulk import for the records you already have on paper",
    ],
  },
  {
    icon: BarChart3,
    title: "Payment monitoring",
    blurb: "Know exactly which accounts are behind, and prove where every peso went.",
    points: [
      "Delinquency ageing: 30 / 60 / 90 days and lapsed",
      "Installment schedules and automatic overdue flagging",
      "Official receipts with sequential numbering",
      "Reconciliation and exportable reports per branch",
    ],
  },
];

const FLOW = [
  {
    step: "01",
    title: "Staff records the payment",
    body: "Cash, GCash, Maya, bank transfer, or check — with the O.R. number and date.",
    icon: CreditCard,
  },
  {
    step: "02",
    title: "The account updates",
    body: "Total paid, outstanding balance, installment number, and running balance recalculate.",
    icon: Wallet,
  },
  {
    step: "03",
    title: "Client portal reflects it",
    body: "The planholder's payments summary and history update the moment it's saved.",
    icon: FileHeart,
  },
  {
    step: "04",
    title: "The SOA matches",
    body: "Print or export the Statement of Account and every figure agrees — to the centavo.",
    icon: FileText,
  },
];

const LEDGER_ROWS = [
  ["09/16/2025", "001234", "₱500.00", "1", "₱38,500.00", "Paid"],
  ["10/16/2025", "001278", "₱500.00", "2", "₱38,000.00", "Paid"],
  ["11/16/2025", "001301", "₱500.00", "3", "₱37,500.00", "Paid"],
];

/* ── Hero ───────────────────────────────────────────────────────────────── */

function Hero() {
  const navigate = useNavigate();

  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-10 sm:px-6 lg:px-10 lg:pt-16">
      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="flex justify-center">
          <Eyebrow>Pre-need plan records &amp; payments</Eyebrow>
        </div>
        <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-evergreen sm:text-5xl lg:text-[58px]">
          One system for every planholder, peso, and statement.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-[15.5px] leading-relaxed text-stone">
          Evangelist runs its Life Plan records on a single source of truth.
          Families get a portal that shows the same figures our staff see, and our
          team gets the tools to keep them accurate — {MOTTO}
        </p>
      </Reveal>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        {[
          {
            img: PORTAL_IMG,
            alt: "A family reviewing their memorial plan",
            eyebrow: "For planholders & families",
            title: "Client portal",
            pitch:
              "Sign in with the email on your plan and see your balance, payment history, and official statement.",
            href: "#client-portal",
            cta: "See what families get",
          },
          {
            img: STAFF_IMG,
            alt: "Staff office managing plan records",
            eyebrow: "For records & branch staff",
            title: "Staff portal",
            pitch:
              "Record payments, manage planholders, track delinquencies, and reconcile the day's collections.",
            href: "#staff-portal",
            cta: "See the staff workspace",
          },
        ].map((t, i) => (
          <Reveal key={t.title} delay={i * 0.08}>
            <div className="group relative h-[440px] overflow-hidden rounded-[28px] shadow-xl ring-1 ring-black/5 lg:h-[520px]">
              <img
                {...t.img}
                alt={t.alt}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-evergreen via-evergreen/75 to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-7 lg:p-9">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-gold-soft">
                  {t.eyebrow}
                </p>
                <h2 className="mt-3 font-display text-[34px] font-semibold leading-none text-white lg:text-[42px]">
                  {t.title}
                </h2>
                <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-white/80">
                  {t.pitch}
                </p>
                <a
                  href={t.href}
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-paper px-6 py-3 text-[13.5px] font-bold text-evergreen transition-all hover:gap-3 hover:bg-white"
                >
                  {t.cta}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {[
            { k: "1 source of truth", v: "payments feed the portal and the SOA" },
            { k: "30/60/90 day", v: "delinquency ageing on every contract" },
            { k: "Multi-branch", v: "a unique local identity per branch" },
            { k: "PDF & print", v: "statements on the official paper form" },
          ].map((s) => (
            <div key={s.k} className="bg-white px-5 py-6">
              <p className="font-display text-[19px] font-semibold text-evergreen">{s.k}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-stone">{s.v}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button
          className="h-12 rounded-full px-7 text-[14.5px] font-bold"
          onClick={() => navigate("/auth?returnTo=%2Fportal")}
        >
          Open the client portal
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="h-12 rounded-full border-evergreen/25 px-7 text-[14.5px] font-bold text-evergreen hover:bg-evergreen hover:text-white"
          onClick={() => navigate("/auth?as=staff")}
        >
          Staff &amp; agents — sign in
        </Button>
      </div>
    </section>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div id="top" className="bg-paper text-ink antialiased">
      <NavHeader />
      <Hero />

      {/* ── Four pillars ── */}
      <section className="mt-24 border-y border-line bg-cream lg:mt-32">
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10 lg:py-28">
          <Reveal>
            <Eyebrow>What the system does</Eyebrow>
            <h2 className="mt-5 max-w-2xl font-display text-3xl font-semibold leading-tight text-evergreen lg:text-[42px]">
              Four things, done properly.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-stone">
              Just the money, the records, and the two portals that keep families
              and staff looking at the same numbers.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.06}>
                <div className="h-full rounded-3xl border border-line bg-white p-7 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg lg:p-8">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-evergreen text-white">
                    <p.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 font-display text-[24px] font-semibold text-evergreen">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-stone">{p.blurb}</p>
                  <ul className="mt-5 space-y-2.5">
                    {p.points.map((pt) => (
                      <li
                        key={pt}
                        className="flex items-start gap-2.5 text-[13px] text-ink/80"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── The money trail ── */}
      <section className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <Reveal>
            <Eyebrow>The money trail</Eyebrow>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight text-evergreen lg:text-[42px]">
              Record a payment once. Everything else follows.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-stone">
              There is one payments table behind the whole system. The client portal
              and the Statement of Account don't keep their own copies — they
              calculate from the same records, so a balance can never be right in one
              place and wrong in the other.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                className="h-12 rounded-full px-7 text-[14.5px] font-bold"
                onClick={() => navigate("/auth?as=staff")}
              >
                Open the staff portal
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-full border-evergreen/25 px-7 text-[14.5px] font-bold text-evergreen hover:bg-evergreen hover:text-white"
                onClick={() => navigate("/auth?returnTo=%2Fportal")}
              >
                See my statement
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative overflow-hidden rounded-[28px] shadow-xl ring-1 ring-black/5">
              <img
                {...LEDGER_IMG}
                alt="Ledger and payment records"
                loading="lazy"
                className="h-full max-h-[420px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-evergreen/85 via-evergreen/45 to-transparent" />
            </div>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((f, i) => (
            <Reveal key={f.step} delay={i * 0.06}>
              <div className="h-full rounded-2xl border border-line bg-white p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-evergreen/8 text-evergreen">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-[28px] font-semibold text-line">
                    {f.step}
                  </span>
                </div>
                <p className="mt-4 text-[15px] font-bold text-ink">{f.title}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-stone">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Client portal ── */}
      <section id="client-portal" className="scroll-mt-24 border-y border-line bg-cream">
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <Reveal>
              <div className="rounded-3xl border border-line bg-white p-6 shadow-xl lg:p-7">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div>
                    <p className="text-[15px] font-bold text-ink">Account summary</p>
                    <p className="mt-0.5 font-mono text-[11.5px] text-stone">
                      St. Gabriel · 00000000
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-emerald-800">
                    Current
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-5 sm:grid-cols-3">
                  {[
                    ["Plan value", "₱39,000"],
                    ["Total paid", "₱1,500"],
                    ["Outstanding", "₱37,500"],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone">
                        {l}
                      </p>
                      <p className="mt-0.5 font-display text-[20px] font-semibold text-evergreen">
                        {v}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-7 text-[12px] font-bold uppercase tracking-[0.16em] text-evergreen">
                  Payment history
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[11.5px]">
                    <thead>
                      <tr className="border-b border-line text-left">
                        {["Date", "O.R. No.", "Amount", "Inst.", "Balance", "Remarks"].map(
                          (h) => (
                            <th
                              key={h}
                              className="pb-2 pr-2 font-bold uppercase tracking-wider text-stone"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {LEDGER_ROWS.map((r) => (
                        <tr key={r[1]} className="border-b border-line/30">
                          <td className="py-2 pr-2 font-mono">{r[0]}</td>
                          <td className="py-2 pr-2 font-mono text-stone">{r[1]}</td>
                          <td className="py-2 pr-2 font-mono font-bold text-evergreen">
                            {r[2]}
                          </td>
                          <td className="py-2 pr-2 text-center font-mono">{r[3]}</td>
                          <td className="py-2 pr-2 text-right font-mono text-stone">
                            {r[4]}
                          </td>
                          <td className="py-2 text-stone">{r[5]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full bg-evergreen px-4 py-2 text-[12px] font-bold text-white">
                    <FileText className="h-3.5 w-3.5" />
                    View statement of account
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-bold text-evergreen">
                    Download PDF
                  </span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <Eyebrow>Client portal</Eyebrow>
              <h2 className="mt-5 font-display text-3xl font-semibold leading-tight text-evergreen lg:text-[42px]">
                Families stop calling to ask for their balance.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-stone">
                Planholders sign in with the email we already have on their record.
                No separate account to create, no app to install — just the numbers,
                in the same words our office uses.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  {
                    icon: Wallet,
                    title: "Payments summary",
                    body: "Plan value, total paid, outstanding balance, monthly installment, next due date, and payment status — per plan.",
                  },
                  {
                    icon: Receipt,
                    title: "Payment history",
                    body: "Every recorded payment with its O.R. number, installment number, running balance, and remarks.",
                  },
                  {
                    icon: FileText,
                    title: "Statement of Account",
                    body: "The official paper form — planholder details, up to four beneficiaries, plan information, the payment ledger, and signatures. Print it or export a PDF.",
                  },
                  {
                    icon: Link2,
                    title: "Account linking",
                    body: "If their email isn't on file yet, they can send a linking request. Staff verify it, and the plans appear immediately.",
                  },
                ].map((f) => (
                  <li key={f.title} className="flex gap-4">
                    <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-evergreen text-white">
                      <f.icon className="h-[18px] w-[18px]" />
                    </span>
                    <div>
                      <p className="text-[14.5px] font-bold text-ink">{f.title}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-stone">
                        {f.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-9 h-12 rounded-full px-7 text-[14.5px] font-bold"
                onClick={() => navigate("/auth?returnTo=%2Fportal")}
              >
                Sign in to my portal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Staff portal ── */}
      <section
        id="staff-portal"
        className="scroll-mt-24 mx-auto max-w-[1440px] px-6 py-20 lg:px-10 lg:py-28"
      >
        <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <Reveal>
            <Eyebrow>Staff portal</Eyebrow>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight text-evergreen lg:text-[42px]">
              The office workspace, scoped to who you are.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-stone">
              Roles decide what a person can see and do. Branch assignment decides
              which records they see. A cashier, a branch manager, and the CEO each
              open a different — and correct — workspace.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Users,
                  title: "Client management",
                  body: "Planholder records with beneficiaries, contact details, and status.",
                },
                {
                  icon: FileText,
                  title: "Contracts & plans",
                  body: "Plan type, plan value, monthly amortization, and maturity.",
                },
                {
                  icon: CreditCard,
                  title: "Payments & receipts",
                  body: "Record collections and issue sequentially numbered official receipts.",
                },
                {
                  icon: LineChart,
                  title: "Reports & ageing",
                  body: "Delinquency buckets, collections, and per-branch performance.",
                },
                {
                  icon: Building2,
                  title: "Multi-branch",
                  body: "Every branch keeps its own identity; the CEO sees across all of them.",
                },
                {
                  icon: UserCog,
                  title: "Roles & access",
                  body: "Assign staff by position — Branch Manager, Collector, or Cashier.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-evergreen/8 text-evergreen">
                    <f.icon className="h-[18px] w-[18px]" />
                  </span>
                  <p className="mt-3.5 text-[13.5px] font-bold text-ink">{f.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-stone">{f.body}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative overflow-hidden rounded-[28px] shadow-xl ring-1 ring-black/5">
              <img
                {...RECORDS_IMG}
                alt="Staff reviewing plan records"
                loading="lazy"
                className="h-full max-h-[560px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-evergreen/90 via-evergreen/30 to-transparent" />
              <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-white/95 p-5 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                  Needs attention
                </p>
                <div className="mt-3 space-y-2">
                  {[
                    ["Reyes, Marilou", "90 days late", "text-red-700"],
                    ["Sarmiento, Erik", "30 days late", "text-amber-700"],
                    ["Villanueva, Ana", "payment due in 3 days", "text-stone"],
                  ].map(([n, s, c]) => (
                    <div
                      key={n}
                      className="flex items-center justify-between rounded-xl bg-cream px-3.5 py-2.5"
                    >
                      <span className="text-[12.5px] font-semibold text-ink">{n}</span>
                      <span className={`text-[11.5px] font-bold ${c}`}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Payment monitoring ── */}
      <section id="payments" className="scroll-mt-24 border-y border-line bg-cream">
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10 lg:py-28">
          <Reveal className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center">
              <Eyebrow>Payment monitoring</Eyebrow>
            </div>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight text-evergreen lg:text-[42px]">
              Every peso accounted for, every branch.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-stone">
              Collections, overdue accounts, and the day's cash tally all live in the
              same place — with an audit trail behind every change.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {[
              {
                img: MONITOR_IMG,
                title: "Collections & reconciliation",
                body: "Each cashier closes the day against what was physically counted, and any variance is recorded — not quietly edited away.",
              },
              {
                img: LEDGER_IMG,
                title: "Delinquency ageing",
                body: "Contracts bucket themselves into current, 30, 60, 90 days, and lapsed from their real payment dates.",
              },
              {
                img: RECORDS_IMG,
                title: "Reports & audit trail",
                body: "Filter by branch and period, then export the exact figures — with a log of who recorded or changed what.",
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 0.07}>
                <div className="h-full overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
                  <img
                    {...c.img}
                    alt={c.title}
                    loading="lazy"
                    className="h-44 w-full object-cover"
                  />
                  <div className="p-6">
                    <h3 className="font-display text-[20px] font-semibold text-evergreen">
                      {c.title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-stone">{c.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="mt-14 grid gap-6 rounded-3xl border border-line bg-white p-8 lg:grid-cols-3 lg:p-10">
              {[
                {
                  icon: ShieldCheck,
                  title: "Role-based access",
                  body: "Enforced on the server, not just hidden in the interface. Staff endpoints reject accounts without a staff role.",
                },
                {
                  icon: Clock,
                  title: "Audit trail",
                  body: "Creating, editing, or deleting a client, contract, payment, or receipt is written to the log with the user and timestamp.",
                },
                {
                  icon: Building2,
                  title: "Branch isolation",
                  body: "Branch staff only ever read their own branch's planholders, payments, and reports.",
                },
              ].map((t) => (
                <div key={t.title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-evergreen text-white">
                    <t.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-ink">{t.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-stone">
                      {t.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Client management ── */}
      <section
        id="clients"
        className="scroll-mt-24 mx-auto max-w-[1440px] px-6 py-20 lg:px-10 lg:py-28"
      >
        <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <Reveal>
            <div className="rounded-3xl border border-line bg-white p-7 shadow-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                Sample planholder record
              </p>
              <p className="mt-3 font-display text-[24px] font-semibold text-evergreen">
                Dela Cruz, Juan P.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["Contact", "0917 000 0000"],
                  ["Address", "Purok 1, Malaybalay City"],
                  ["Birthday", "January 1, 1975"],
                  ["Branch", "Malaybalay (main office)"],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-cream px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone">
                      {l}
                    </p>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-ink">{v}</p>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                Beneficiaries
              </p>
              <div className="mt-3 space-y-2">
                {[
                  ["1. Dela Cruz, Maria P.", "45", "Spouse"],
                  ["2. Dela Cruz, Jose P.", "17", "Son"],
                ].map(([n, a, r]) => (
                  <div
                    key={n}
                    className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-[12.5px]"
                  >
                    <span className="font-semibold text-ink">{n}</span>
                    <span className="text-stone">
                      Age {a} · {r}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Eyebrow>Client management</Eyebrow>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight text-evergreen lg:text-[42px]">
              The record is the single place everything else points at.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-stone">
              A planholder record holds the identity, the beneficiaries, the plan, and
              every payment attached to it. Fix a detail once and the portal, the
              Statement of Account, and every report agree.
            </p>
            <ul className="mt-8 space-y-3.5">
              {[
                "Up to four beneficiaries per record, with age and relationship",
                "Search by name or contact number; filter by plan status",
                "Reassign a planholder to another branch (admins only)",
                "Bulk import from the spreadsheet your office already keeps",
                "Delete with a single audit entry — no orphaned payments",
              ].map((p) => (
                <li key={p} className="flex items-start gap-3 text-[13.5px] text-ink/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Final call to action ── */}
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
                  Planholders, families &amp; agents
                </p>
                <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight text-white lg:text-[40px]">
                  Your plan, your balance, your statement — in one place
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/70">
                  Track your Life Plan, see every payment and its running balance, and
                  print your Statement of Account whenever you need it.
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
                    onClick={() => navigate("/auth?as=staff")}
                  >
                    Staff &amp; agents — sign in
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="scroll-mt-24 bg-pine text-white/70">
        <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-8 lg:px-10">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
            <div>
              <BrandBlock light />
              <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-white/55">
                A family-owned DeathCare company offering pre-need memorial life plans
                and 24/7 memorial chapel services, guided by our promise — {MOTTO}
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
              <div className="mt-7 flex items-start gap-3.5">
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

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-gold-soft">
                Reach us
              </p>
              <ul className="mt-5 space-y-4 text-[13px] leading-relaxed">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
                  <span>
                    Main Office (Malaybalay)
                    <br />
                    2nd Floor, Gabrinez Bldg, Fortich St.,
                    <br />
                    Malaybalay City, Bukidnon 8700
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
                  <span>
                    <span className="text-white">24/7 Hotline:</span> 0955 399 1034
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
                  <span>evangelistfuneralservices@gmail.com</span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-soft" />
                  <span>Office hours: Mon–Sat, 8:00 AM – 5:00 PM</span>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-gold-soft">
                Portals
              </p>
              <ul className="mt-5 space-y-3 text-[13px]">
                {NAV_LINKS.map((l) => (
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
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/auth?as=staff")}
                    className="inline-flex items-center gap-2 transition-colors hover:text-gold-soft"
                  >
                    <span className="h-1 w-1 rounded-full bg-gold-soft/60" />
                    Staff sign in
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-gold-soft">
                Policies &amp; Support
              </p>
              <ul className="mt-5 space-y-3 text-[13px]">
                {[
                  "Privacy Policy",
                  "Terms of Use",
                  "Data Privacy Notice",
                  "Fair Collection Notice",
                  "FAQs",
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
            </div>
          </div>

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
    </div>
  );
}
