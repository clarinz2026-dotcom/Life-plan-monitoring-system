import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  FileHeart,
  Loader2,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Link } from "react-router";
import {
  CONTRACT_PILL,
  Card,
  EmptyState,
  PortalShell,
  StatusPill,
  fmtDate,
  fmtPeso,
  initials,
} from "./shared";
import { SOAButton } from "./SOAButton";

const CHANNEL_LABEL: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  check: "Check",
};

export default function Plans() {
  const overview = useQuery(api.portal.myOverview);

  if (overview === undefined) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-evergreen" />
      </div>
    );
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
        subtitle="Your complete account statement — schedules, payments, and official receipts for every contract."
      />

      {records.map((group) => {
        const c = group.client;
        return (
          <section key={c._id} className="space-y-5">
            {/* Holder header */}
            <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-evergreen text-[14px] font-bold text-white">
                {initials(`${c.firstName} ${c.lastName}`)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15.5px] font-bold text-ink">
                  {c.firstName} {c.middleName ? `${c.middleName} ` : ""}
                  {c.lastName}
                </p>
                <p className="text-[12px] text-stone">
                  {c.address ? `${c.address}, ` : ""}
                  {c.city}, {c.province}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-stone">
                <span>
                  DOB: <strong className="text-ink">{fmtDate(c.dateOfBirth)}</strong>
                </span>
                <span>
                  Contact: <strong className="text-ink">{c.contactNumber}</strong>
                </span>
                <span>
                  Beneficiary:{" "}
                  <strong className="text-ink">
                    {c.beneficiaryName} ({c.beneficiaryRelationship})
                  </strong>
                </span>
              </div>
              <SOAButton
                records={[group]}
                label="Statement of Account"
                size="sm"
              />
            </Card>

            {group.contracts.length === 0 ? (
              <Card className="px-5 py-8 text-center text-[13px] text-stone">
                No contracts recorded for this planholder yet.
              </Card>
            ) : (
              group.contracts.map((cd) => {
                const { contract } = cd;
                const paid = contract.totalPaid || 0;
                const plan = contract.planAmount || 0;
                const balance = Math.max(0, plan - paid);
                const pct = plan > 0 ? Math.min(100, (paid / plan) * 100) : 0;

                const upcoming = cd.schedules.filter(
                  (s) => s.status !== "paid" && s.status !== "waived"
                );
                const paidSum = cd.payments.reduce((s, p) => s + p.amount, 0);
                const nextDueSchedule = upcoming
                  .filter((s) => s.dueDate >= now)
                  .sort((a, b) => a.dueDate - b.dueDate)[0];

                return (
                  <Card key={contract._id} className="overflow-hidden">
                    {/* Contract header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream/60 px-5 py-4 lg:px-7">
                      <div>
                        <p className="font-display text-[20px] font-semibold text-evergreen">
                          {contract.planType || "Memorial Plan"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[14.5px] leading-relaxed text-stone">
                          <span className="font-mono text-[14px] font-semibold tracking-tight text-ink">
                            {contract.contractNumber}
                          </span>
                          <span aria-hidden className="h-4 w-px bg-line" />
                          <span>
                            Effectivity Date:{" "}
                            <strong className="font-semibold text-ink">
                              {fmtDate(contract.startDate)}
                            </strong>
                          </span>
                          {contract.maturityDate ? (
                            <>
                              <span aria-hidden className="h-4 w-px bg-line" />
                              <span>
                                Maturity Date:{" "}
                                <strong className="font-semibold text-ink">
                                  {fmtDate(contract.maturityDate)}
                                </strong>
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-semibold text-stone">
                          {fmtPeso(contract.monthlyAmortization)} / month
                        </span>
                        <StatusPill map={CONTRACT_PILL} status={contract.contractStatus} />
                      </div>
                    </div>

                    {/* Account summary — the same figures printed on the SOA */}
                    <div
                      className="border-t border-line px-5 py-5 lg:px-7"
                      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
                    >
                      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-evergreen">
                        Account summary
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                        {(
                          [
                            { l: "Plan value", v: fmtPeso(plan) },
                            { l: "Total paid", v: fmtPeso(paid) },
                            {
                              l: "Outstanding balance",
                              v: fmtPeso(balance),
                              cls: balance > 0 ? "text-amber-700" : "text-emerald-700",
                            },
                            { l: "Monthly installment", v: fmtPeso(contract.monthlyAmortization) },
                            {
                              l: "Next due date",
                              v: nextDueSchedule ? fmtDate(nextDueSchedule.dueDate) : "—",
                            },
                            {
                              l: "Payment status",
                              v: <StatusPill map={CONTRACT_PILL} status={contract.contractStatus} />,
                            },
                          ] as { l: string; v: ReactNode; cls?: string }[]
                        ).map((s) => (
                          <div key={s.l}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone">
                              {s.l}
                            </p>
                            <p
                              className={`mt-1 text-[19px] font-bold ${
                                s.cls ?? "text-evergreen"
                              }`}
                            >
                              {s.v}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="border-t border-line px-5 py-4 lg:px-7">
                      <div className="flex items-center justify-between text-[11.5px] font-semibold text-stone">
                        <span>Payment progress</span>
                        <span>
                          {pct.toFixed(0)}% of plan price settled
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream">
                        <div
                          className="h-full rounded-full bg-evergreen transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Payment history — matches the SOA payment table */}
                    <div className="grid gap-0 border-t border-line">
                      <div className="px-5 py-5 lg:px-7">
                        <div className="flex items-center justify-between">
                          <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-evergreen">
                            <Wallet className="h-4 w-4 text-gold" />
                            Payment history
                          </p>
                          <SOAButton
                            records={[group]}
                            contractId={contract._id}
                            label="View SOA"
                            variant="ghost"
                            size="sm"
                          />
                        </div>
                        {cd.payments.length === 0 ? (
                          <p className="mt-4 text-[12.5px] text-stone">
                            No payments recorded yet.
                          </p>
                        ) : (
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-[11.5px]">
                              <thead>
                                <tr className="border-b border-line text-left">
                                  <th className="pb-2 pr-2 font-bold uppercase tracking-wider text-stone">Date</th>
                                  <th className="pb-2 pr-2 font-bold uppercase tracking-wider text-stone">O.R. No.</th>
                                  <th className="pb-2 pr-2 text-right font-bold uppercase tracking-wider text-stone">Amount</th>
                                  <th className="pb-2 pr-2 text-center font-bold uppercase tracking-wider text-stone">Installment</th>
                                  <th className="pb-2 pr-2 text-right font-bold uppercase tracking-wider text-stone">Balance</th>
                                  <th className="pb-2 font-bold uppercase tracking-wider text-stone">Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Sort oldest first for installment numbering + running balance
                                  const sorted = [...cd.payments].sort((a, b) => a.paymentDate - b.paymentDate);
                                  let runningBalance = contract.planAmount;
                                  let installmentNo = 0;
                                  return sorted.map((p) => {
                                    runningBalance = Math.max(0, runningBalance - p.amount);
                                    installmentNo += 1;
                                    return (
                                      <tr key={p._id} className="border-b border-line/30">
                                        <td className="py-2 pr-2 font-mono">{fmtDate(p.paymentDate)}</td>
                                        <td className="py-2 pr-2 font-mono text-stone">
                                          {p.orNumber || "—"}
                                        </td>
                                        <td className="py-2 pr-2 text-right font-mono font-bold text-evergreen">
                                          {fmtPeso(p.amount)}
                                        </td>
                                        <td className="py-2 pr-2 text-center font-mono">{installmentNo}</td>
                                        <td className="py-2 pr-2 text-right font-mono text-stone">
                                          {fmtPeso(runningBalance)}
                                        </td>
                                        <td className="py-2 text-stone">
                                          {p.remarks ||
                                            CHANNEL_LABEL[p.paymentChannel] ||
                                            p.paymentChannel}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                            <p className="pt-2 text-[11.5px] text-stone">
                              {cd.payments.length} payment
                              {cd.payments.length > 1 ? "s" : ""} recorded ·{" "}
                              {fmtPeso(paidSum)} total
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Receipts */}
                    {cd.receipts.length > 0 && (
                      <div className="border-t border-line px-5 py-5 lg:px-7">
                        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-evergreen">
                          <ReceiptText className="h-4 w-4 text-gold" />
                          Official receipts
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {cd.receipts.slice(0, 8).map((r) => (
                            <div
                              key={r._id}
                              className="flex items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2.5 text-[12px]"
                            >
                              <span className="font-mono font-bold text-ink">
                                OR {r.receiptNumber}
                              </span>
                              <span className="text-stone">{fmtDate(r.paymentDate)}</span>
                              <span className="font-mono font-semibold text-evergreen">
                                {fmtPeso(r.amount)}
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
                            (02) 8-700-0000
                          </a>{" "}
                          or visit any branch — we can print it on the spot.
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </section>
        );
      })}
    </div>
  );
}
