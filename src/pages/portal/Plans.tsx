import { api } from "@/convex/_generated/api";
import { PageLoading } from "@/components/PageLoading";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { ArrowRight, FileHeart, ReceiptText, Wallet } from "lucide-react";
import { Link } from "react-router";
import {
  CONTRACT_PILL,
  EmptyState,
  PortalShell,
  StatusPill,
  fmtDate,
  fmtDateNumeric,
  fmtPesoExact,
  initials,
} from "./shared";
import { SOAButton } from "./SOAButton";
import {
  agingCell,
  installmentDueDate,
  isAdvancedStatus,
  splitAddressEmail,
} from "@/components/SOADocument";
import type { Doc } from "@/convex/_generated/dataModel";

/**
 * The statement face. The portal is set in Arial throughout — headings,
 * statement body, figures and table cells — so every label reads the same as
 * the figures beside it. (The printed SOA keeps its own serif styling; this is
 * the on-screen presentation.)
 */
const STATEMENT_FONT = {
  fontFamily: 'Arial, "Helvetica Neue", Helvetica, ui-sans-serif, sans-serif',
} as const;

/** Payment channels, spelled out in the statement's REMARKS column. */
const CHANNEL_LABEL: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  check: "Check",
};

/** Age in whole years, as printed in the AGE field. */
function computeAge(dob?: number) {
  if (!dob) return undefined;
  const now = new Date();
  const birth = new Date(dob);
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

type Beneficiary = { name: string; age?: number; relationship: string };

/** Up to four beneficiaries, falling back to the single-beneficiary fields. */
function beneficiariesOf(client: Doc<"clients">): Beneficiary[] {
  if (client.beneficiaries && client.beneficiaries.length > 0) {
    return client.beneficiaries.slice(0, 4);
  }
  return [
    {
      name: client.beneficiaryName || "—",
      relationship: client.beneficiaryRelationship || "—",
    },
  ];
}

/** The brand-green section bar from the printed statement. */
function SectionBar({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 inline-block bg-evergreen px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white">
      {children}
    </p>
  );
}

/** A label sitting above its value on a ruled line, as on the document. */
function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-stone">
        {label}
      </p>
      <p className="mt-1.5 border-b border-line pb-1.5 text-[13px] leading-snug text-ink">
        {value ?? "—"}
      </p>
    </div>
  );
}

/** Thin-ruled table in the statement's header/fill style. */
function StatementTable({
  columns,
  children,
}: {
  columns: { label: ReactNode; width: string; align?: "left" | "center" | "right" }[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {columns.map((c, i) => (
            <col key={i} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className={`border border-line bg-sage/50 px-2 py-1.5 align-middle text-[9px] font-bold uppercase leading-tight tracking-[0.03em] text-evergreen ${
                  c.align === "left"
                    ? "text-left"
                    : c.align === "right"
                      ? "text-right"
                      : "text-center"
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function Plans() {
  const overview = useQuery(api.portal.myOverview);

  if (overview === undefined) {
    return <PageLoading label="Loading your plan" className="min-h-[50vh]" />;
  }
  if (overview === null) return null;

  const records = overview.records ?? [];
  const now = Date.now();

  if (records.length === 0) {
    return (
      <div className="space-y-6">
        <PortalShell
          title="My Plans & Payments"
          subtitle="Full statements for every plan under your account."
        />
        <EmptyState
          icon={FileHeart}
          title="No plan records linked to this account"
          subtitle="Records are matched by the email registered with the office. Request help below and we’ll connect your plan to this portal."
        >
          <Link to="/portal/link-account">
            <Button className="h-10 rounded-full px-6 text-[13.5px]">
              Request account linking <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PortalShell
        title="My Plans & Payments"
        subtitle="Your complete account statement — plans, beneficiaries, payment history and balances, in the same format as the statement we print."
      />

      {records.map((group) => {
        const c = group.client;
        // Address and email get their own lines; staff sometimes type the
        // email into the address field.
        const contact = splitAddressEmail(
          [c.address, c.city, c.province].filter(Boolean).join(", "),
          c.email
        );
        const beneficiaries = beneficiariesOf(c);
        const beneficiaryRows = Array.from({ length: 4 }, (_, i) => beneficiaries[i]);

        return (
          <section key={c._id} className="space-y-5">
            {/* ── Planholder information + beneficiaries ── */}
            <div className="border border-line bg-paper shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-evergreen px-5 py-3.5 lg:px-7">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-[12px] font-bold text-white">
                    {initials(`${c.firstName} ${c.lastName}`)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[18px] font-semibold text-white">
                      {c.firstName} {c.middleName ? `${c.middleName} ` : ""}
                      {c.lastName}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                      Planholder
                    </p>
                  </div>
                </div>
                <SOAButton
                  records={[group]}
                  label="Statement of Account"
                  size="sm"
                  variant="outline"
                  className="rounded-full border-white/40 bg-white/10 text-white hover:bg-white hover:text-evergreen"
                />
              </header>

              <div className="space-y-7 px-5 py-6 lg:px-7" style={STATEMENT_FONT}>
                <div>
                  <SectionBar>Planholder Information</SectionBar>
                  <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                    <Field
                      label="Planholder’s Name"
                      value={`${c.lastName}, ${c.firstName}${c.middleName ? ` ${c.middleName}` : ""}`}
                    />
                    <Field label="Contact Number" value={c.contactNumber || "—"} />
                    <Field label="Address" value={contact.address} />
                    <Field
                      label="Email Address"
                      value={contact.email || "—"}
                    />
                    <div className="grid grid-cols-2 gap-x-10">
                      <Field
                        label="Age"
                        value={computeAge(c.dateOfBirth) ?? "—"}
                      />
                      <Field label="Birthday" value={fmtDate(c.dateOfBirth)} />
                    </div>
                  </div>
                </div>

                <div>
                  <SectionBar>Beneficiaries</SectionBar>
                  <StatementTable
                    columns={[
                      { label: "#", width: "6%" },
                      { label: "Name", width: "54%", align: "left" },
                      { label: "Age", width: "15%" },
                      { label: "Relationship", width: "25%" },
                    ]}
                  >
                    {beneficiaryRows.map((b, i) => (
                      <tr key={i}>
                        <td className="border border-line px-2.5 py-2 text-center">
                          {i + 1}
                        </td>
                        <td className="border border-line px-2.5 py-2">
                          {b ? b.name : ""}
                        </td>
                        <td className="border border-line px-2.5 py-2 text-center">
                          {b?.age !== undefined ? b.age : ""}
                        </td>
                        <td className="border border-line px-2.5 py-2 text-center">
                          {b ? b.relationship : ""}
                        </td>
                      </tr>
                    ))}
                  </StatementTable>
                </div>
              </div>
            </div>

            {/* ── One statement block per plan ── */}
            {group.contracts.length === 0 ? (
              <div className="border border-line bg-paper px-5 py-8 text-center text-[13px] text-stone">
                No contracts recorded for this planholder yet.
              </div>
            ) : (
              group.contracts.map((cd) => {
                const { contract } = cd;
                const paid = contract.totalPaid || 0;
                const plan = contract.planAmount || 0;
                const balance = Math.max(0, plan - paid);
                const pct = plan > 0 ? Math.min(100, (paid / plan) * 100) : 0;

                const sortedPayments = [...cd.payments].sort(
                  (a, b) => a.paymentDate - b.paymentDate
                );
                let runningBalance = plan;

                const upcoming = cd.schedules.filter(
                  (s) => s.status !== "paid" && s.status !== "waived"
                );
                const paidSum = cd.payments.reduce((s, p) => s + p.amount, 0);
                const nextDueSchedule = upcoming
                  .filter((s) => s.dueDate >= now)
                  .sort((a, b) => a.dueDate - b.dueDate)[0];
                const hasPastDue = cd.schedules.some(
                  (s) => s.status === "overdue" || (s.status === "pending" && s.dueDate < now)
                );

                /*
                 * The next installment still owed. It is counted from the
                 * payments on record, so settling several installments at once
                 * pushes this date further out — a plan effective Aug 22 with
                 * four installments paid has its fifth due Jan 22. The stored
                 * schedule rows are only a fallback: `payment_schedules` holds
                 * no rows, so in practice this is always derived.
                 */
                const isFullyPaid = plan > 0 && paid >= plan;
                const nextDueTs = isFullyPaid
                  ? null
                  : installmentDueDate(
                      contract.startDate,
                      cd.payments.length + 1
                    );
                const nextDueLabel =
                  nextDueTs !== null
                    ? fmtDate(nextDueTs)
                    : nextDueSchedule
                      ? fmtDate(nextDueSchedule.dueDate)
                      : "—";

                /*
                 * Payment status. A plan whose installments have been settled
                 * ahead of the calendar — more payments on record than due
                 * dates have passed — reads "Advanced" rather than the plain
                 * "Good Payer", so the family can see at a glance that they
                 * are paying in advance. Fully paid keeps its own pill, and
                 * everything else falls back to the stored contract status.
                 * The rule lives in the SOA module so the printed statement
                 * agrees with this pill.
                 */
                const statusKey =
                  isFullyPaid
                    ? "fully_paid"
                    : isAdvancedStatus(contract.startDate, cd.payments.length, now)
                      ? "advanced"
                      : contract.contractStatus;

                return (
                  <article
                    key={contract._id}
                    className="border border-line bg-paper shadow-sm"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream px-5 py-3.5 lg:px-7">
                      <div className="min-w-0">
                        <p className="truncate text-[19px] font-semibold text-evergreen">
                          {contract.planType || "Memorial Plan"}
                        </p>
                        <p
                          className="mt-0.5 text-[14px] text-ink/70"
                          style={STATEMENT_FONT}
                        >
                          Plan No. {contract.contractNumber} · Effectivity Date: <strong className="font-bold text-ink">{fmtDate(contract.startDate)}</strong>
                        </p>
                      </div>
                      <StatusPill map={CONTRACT_PILL} status={statusKey} />
                    </header>

                    <div className="space-y-7 px-5 py-6 lg:px-7" style={STATEMENT_FONT}>
                      {/* ── Plan information ── */}
                      <div>
                        <SectionBar>Plan Information</SectionBar>
                        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                          <Field label="Plan Value" value={fmtPesoExact(plan)} />
                          <Field
                            label="Plan Type"
                            value={contract.planType || "Memorial Plan"}
                          />
                          <Field
                            label="Monthly Installment"
                            value={fmtPesoExact(contract.monthlyAmortization)}
                          />
                          <Field label="Due Date" value={nextDueLabel} />
                          <Field
                            label="EFS OPC Control No."
                            value={contract.contractNumber}
                          />
                          <Field
                            label="Effectivity Date"
                            value={fmtDate(contract.startDate)}
                          />
                        </div>
                      </div>

                      {/* ── Payment history (same records as the SOA) ── */}
                      <div>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          <p className="inline-flex h-8 items-center gap-2 whitespace-nowrap bg-evergreen px-3.5 text-[10.5px] font-bold uppercase leading-none tracking-[0.16em] text-white">
                            <Wallet className="h-3.5 w-3.5" />
                            Payment History
                          </p>
                          <SOAButton
                            records={[group]}
                            contractId={contract._id}
                            label="View SOA"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 rounded-full text-[12.5px]"
                          />
                        </div>

                        {/*
                          Mirrors the printed Statement of Account exactly: the
                          same ten columns, in the same order, computed from the
                          same helpers, so the family never sees a figure here
                          that disagrees with the paper statement.
                        */}
                        {sortedPayments.length === 0 ? (
                          <p className="text-[12.5px] text-stone">
                            No payments recorded yet.
                          </p>
                        ) : (
                          <StatementTable
                            columns={[
                              { label: "Payment Date", width: "11%" },
                              { label: "LPA Number", width: "9.5%" },
                              { label: <>Effectivity<br />Date</>, width: "10.5%" },
                              { label: "Due Date", width: "10%" },
                              { label: "Amount", width: "10.5%" },
                              { label: "Aging", width: "9.5%" },
                              { label: <>Installment<br />No.</>, width: "9%" },
                              { label: "O.R. No.", width: "9.5%" },
                              { label: "Balance", width: "10%" },
                              { label: "Remarks", width: "11%" },
                            ]}
                          >
                            {sortedPayments.map((p, i) => {
                              runningBalance = Math.max(0, runningBalance - p.amount);
                              const installment = i + 1;
                              // Effectivity is a property of the plan, so it
                              // repeats down every row of this plan's ledger.
                              const effectivity = Number.isFinite(contract.startDate)
                                ? fmtDateNumeric(contract.startDate)
                                : "";
                              // Same rule as the statement and the staff page:
                              // installment n falls due on the effectivity day,
                              // n months after the plan's start date.
                              const dueDate = installmentDueDate(
                                contract.startDate,
                                installment
                              );
                              return (
                                <tr key={p._id} className={i % 2 === 1 ? "bg-sage/20" : ""}>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px]">
                                    {fmtDateNumeric(p.paymentDate)}
                                  </td>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px]">
                                    {contract.contractNumber}
                                  </td>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px]">
                                    {effectivity}
                                  </td>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px]">
                                    {dueDate === null ? "" : fmtDateNumeric(dueDate)}
                                  </td>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px] font-bold text-evergreen">
                                    {fmtPesoExact(p.amount)}
                                  </td>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px]">
                                    {agingCell(dueDate, p.paymentDate)}
                                  </td>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px]">
                                    {installment}
                                  </td>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px]">
                                    {p.orNumber || ""}
                                  </td>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px]">
                                    {fmtPesoExact(runningBalance)}
                                  </td>
                                  <td className="border border-line px-2 py-1.5 text-center align-middle text-[11px] leading-snug">
                                    {p.remarks ||
                                      CHANNEL_LABEL[p.paymentChannel] ||
                                      p.paymentChannel}
                                  </td>
                                </tr>
                              );
                            })}
                          </StatementTable>
                        )}

                        <p className="mt-2.5 text-[12px] text-stone">
                          {cd.payments.length} payment
                          {cd.payments.length === 1 ? "" : "s"} recorded ·{" "}
                          {fmtPesoExact(paidSum)} total
                        </p>
                      </div>

                      {/* ── Account summary (the same strip as the SOA) ── */}
                      <div>
                        <SectionBar>Account Summary</SectionBar>
                        <div className="flex flex-col border border-line bg-sage/40 sm:flex-row">
                          {[
                            { l: "Plan Value", v: fmtPesoExact(plan) },
                            { l: "Total Paid", v: fmtPesoExact(paid) },
                            { l: "Outstanding Balance", v: fmtPesoExact(balance) },
                            {
                              l: "Payment Status",
                              v: (
                                <StatusPill
                                  map={CONTRACT_PILL}
                                  status={statusKey}
                                />
                              ),
                            },
                          ].map((cell) => (
                            <div
                              key={cell.l}
                              className="flex-1 border-t border-line px-4 py-3 text-center first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0"
                            >
                              <p className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-stone">
                                {cell.l}
                              </p>
                              <div className="mt-1.5 flex min-h-[26px] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[15px] font-bold text-evergreen">
                                {cell.v}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Progress + next due ── */}
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <div className="flex items-center justify-between text-[11.5px] font-semibold text-stone">
                            <span>Payment Progress</span>
                            <span>
                              {pct.toFixed(0)}% paid ·{" "}
                              {fmtPesoExact(Math.max(0, plan - paid))} remaining
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream">
                            <div
                              className="h-full rounded-full bg-evergreen transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[12.5px]">
                          <span className="text-stone">
                            Next Due Date:{" "}
                            <strong className="font-bold text-ink">
                              {nextDueLabel}
                            </strong>
                          </span>
                          {hasPastDue && (
                            <span className="font-bold text-red-700">
                              ● Has past-due installments
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Official receipts ── */}
                    {cd.receipts.length > 0 && (
                      <div className="border-t border-line px-5 py-5 lg:px-7">
                        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-evergreen">
                          <ReceiptText className="h-4 w-4 text-gold" />
                          Official Receipts
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {cd.receipts.slice(0, 8).map((r) => (
                            <div
                              key={r._id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px]"
                              style={STATEMENT_FONT}
                            >
                              <span className="font-bold text-ink">
                                OR {r.receiptNumber}
                              </span>
                              <span className="text-stone">
                                {fmtDateNumeric(r.paymentDate)}
                              </span>
                              <span className="font-bold text-evergreen">
                                {fmtPesoExact(r.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-[11.5px] text-stone">
                          Need a certified copy of a receipt? Call our 24/7
                          hotline at{" "}
                          <a
                            href="tel:+63287000000"
                            className="font-bold text-evergreen underline underline-offset-2 hover:text-gold"
                          >
                            0955 399 1034
                          </a>{" "}
                          or visit any branch — we can print it on the spot.
                        </p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        );
      })}
    </div>
  );
}
