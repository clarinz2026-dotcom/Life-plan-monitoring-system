import type { LucideIcon } from "lucide-react";
import {
  Box,
  Car,
  CreditCard,
  FileHeart,
  Flame,
  HeartHandshake,
  Landmark,
  ReceiptText,
  Send,
  ShieldCheck,
  UserPlus,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";

/* ── Formatting ─────────────────────────────────────────────────────────── */

export function fmtPeso(n: number | undefined | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(ts: number | undefined | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtDay(ts: number | undefined | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

export function daysUntil(ts: number) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(ts);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/* ── Status pills ───────────────────────────────────────────────────────── */

const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide";

export const CONTRACT_PILL: Record<string, { label: string; cls: string }> = {
  current: {
    label: "Current",
    cls: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  delinquent_30: {
    label: "30 Days Late",
    cls: "border-amber-300 bg-amber-50 text-amber-800",
  },
  delinquent_60: {
    label: "60 Days Late",
    cls: "border-orange-300 bg-orange-50 text-orange-800",
  },
  delinquent_90: {
    label: "90 Days Late",
    cls: "border-red-300 bg-red-50 text-red-700",
  },
  lapsed: {
    label: "Lapsed",
    cls: "border-red-400 bg-red-100 text-red-800",
  },
  fully_paid: {
    label: "Fully Paid",
    cls: "border-evergreen/40 bg-evergreen text-white",
  },
  assigned_death_claim: {
    label: "Claim In Progress",
    cls: "border-violet-300 bg-violet-50 text-violet-800",
  },
};

export const REQUEST_PILL: Record<string, { label: string; cls: string }> = {
  submitted: {
    label: "Submitted",
    cls: "border-sky-300 bg-sky-50 text-sky-800",
  },
  under_review: {
    label: "Under Review",
    cls: "border-amber-300 bg-amber-50 text-amber-800",
  },
  scheduled: {
    label: "Scheduled",
    cls: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  completed: {
    label: "Completed",
    cls: "border-evergreen/40 bg-evergreen text-white",
  },
  cancelled: {
    label: "Cancelled",
    cls: "border-stone-300 bg-stone-100 text-stone-600",
  },
};

export function StatusPill({
  map,
  status,
}: {
  map: Record<string, { label: string; cls: string }>;
  status: string | undefined | null;
}) {
  const s =
    map[status ?? ""] ?? {
      label: status ?? "—",
      cls: "border-line bg-cream text-stone",
    };
  return <span className={`${PILL_BASE} ${s.cls}`}>{s.label}</span>;
}

/* ── Service catalog (everything we offer) ──────────────────────────────── */

export type ServiceItem = {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
};

export const SERVICES: ServiceItem[] = [
  {
    key: "chapel_booking",
    label: "Chapel & Wake Booking",
    desc: "Reserve a memorial chapel, viewing hall, and full wake services — including eBurol-equipped rooms.",
    icon: Landmark,
  },
  {
    key: "cremation",
    label: "Cremation Arrangement",
    desc: "Arrange cremation services, memorial support, urns, and keepsakes at clear, fixed prices.",
    icon: Flame,
  },
  {
    key: "hearse",
    label: "Hearse & Procession",
    desc: "Schedule a hearse, processional vehicles, and transport for the deceased and family.",
    icon: Car,
  },
  {
    key: "eburol_access",
    label: "eBurol Online Viewing",
    desc: "Request access to watch a wake live, 24/7, from anywhere in the world.",
    icon: Video,
  },
  {
    key: "plan_purchase",
    label: "Buy a Life Plan",
    desc: "Get a plan officer to walk you through plans, pricing, and flexible monthly terms.",
    icon: FileHeart,
  },
  {
    key: "casket_urn",
    label: "Caskets & Urns",
    desc: "View casket types and memorial items, get honest pricing, and place a reservation.",
    icon: Box,
  },
  {
    key: "claim_support",
    label: "Death Claim Filing",
    desc: "File or update a death claim with help gathering every required document.",
    icon: ShieldCheck,
  },
  {
    key: "payment_help",
    label: "Payment Assistance",
    desc: "Settle installments or past-due balances online, or ask for help with your payment.",
    icon: CreditCard,
  },
  {
    key: "receipt_copy",
    label: "Receipt / SOA Copy",
    desc: "Request a copy of an official receipt or a statement of account by email.",
    icon: ReceiptText,
  },
  {
    key: "account_link",
    label: "Link My Account",
    desc: "Your plan records didn't appear automatically — connect them to this portal account.",
    icon: UserPlus,
  },
  {
    key: "grief_support",
    label: "Grief & Support",
    desc: "Talk to our bereavement team or get referred to grief resources and counselors.",
    icon: HeartHandshake,
  },
  {
    key: "other",
    label: "Something Else",
    desc: "Ask us anything — inquiries, feedback, donations, or a service not listed above.",
    icon: Send,
  },
];

export const SERVICE_BY_KEY = Object.fromEntries(
  SERVICES.map((s) => [s.key, s])
) as Record<string, ServiceItem>;

export function serviceLabel(key: string) {
  return SERVICE_BY_KEY[key]?.label ?? key.replace(/_/g, " ");
}

/* ── Layout helpers ─────────────────────────────────────────────────────── */

export function PortalShell({
  title,
  eyebrow = "Client Portal",
  subtitle,
  children,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-gold">
        <span className="h-px w-8 bg-current" />
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-evergreen sm:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-stone">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <Card className="px-6 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-evergreen/8 text-evergreen">
        <Icon className="h-7 w-7" />
      </div>
      <p className="mt-4 text-[16px] font-bold text-ink">{title}</p>
      {subtitle && (
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-stone">
          {subtitle}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </Card>
  );
}
