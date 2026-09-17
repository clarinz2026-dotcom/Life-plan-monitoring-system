import type { LucideIcon } from "lucide-react";
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

/**
 * `₱#,##0.00` — the money format printed on the statement of account. The
 * statement screens use this so the figures on My Plans read exactly like the
 * figures on the PDF.
 */
export function fmtPesoExact(n: number | undefined | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return "\u2014";
  return `\u20B1${new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`;
}

/** `MM/DD/YYYY` — the date format printed on the statement of account. */
export function fmtDateNumeric(ts: number | undefined | null) {
  if (!ts) return "\u2014";
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
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

/**
 * Payment status pills.
 *
 * The office works with three payment statuses — Good Payer, Lapsed,
 * Reinstated. The stored `contractStatus` still records *how far* behind a plan
 * is (`delinquent_30/60/90`), which the aging report and the collection
 * follow-ups read, but what planholders and staff see is the three-way wording.
 * The colours keep escalating with the stored status, so a 90-day or lapsed
 * account still reads red while a 30-day one reads amber.
 */
export const CONTRACT_PILL: Record<string, { label: string; cls: string }> = {
  current: {
    label: "Good Payer",
    cls: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  delinquent_30: {
    label: "Lapsed",
    cls: "border-amber-300 bg-amber-50 text-amber-800",
  },
  delinquent_60: {
    label: "Lapsed",
    cls: "border-orange-300 bg-orange-50 text-orange-800",
  },
  delinquent_90: {
    label: "Lapsed",
    cls: "border-red-300 bg-red-50 text-red-700",
  },
  lapsed: {
    label: "Lapsed",
    cls: "border-red-400 bg-red-100 text-red-800",
  },
  fully_paid: {
    label: "Good Payer",
    cls: "border-evergreen/40 bg-evergreen text-white",
  },
  reinstated: {
    label: "Reinstated",
    cls: "border-sky-300 bg-sky-50 text-sky-800",
  },
};

/** Statuses for account-linking requests. */
export const REQUEST_PILL: Record<string, { label: string; cls: string }> = {
  submitted: {
    label: "Submitted",
    cls: "border-sky-300 bg-sky-50 text-sky-800",
  },
  under_review: {
    label: "Under Review",
    cls: "border-blue-300 bg-blue-50 text-blue-800",
  },
  completed: {
    label: "Linked",
    cls: "border-evergreen/40 bg-evergreen text-white",
  },
  cancelled: {
    label: "Declined",
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
      {children}
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
