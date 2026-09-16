import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  FileHeart,
  Info,
  Link2,
  Loader2,
  Phone,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router";
import {
  CONTRACT_PILL,
  Card,
  EmptyState,
  PortalShell,
  REQUEST_PILL,
  StatusPill,
  fmtDate,
  fmtDay,
  fmtPeso,
  initials,
} from "./shared";
import { SOAButton } from "./SOAButton";

export default function Overview() {
  const { user } = useAuth();
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
  const linkRequests = overview.linkRequests ?? [];
  const hasPlans = records.length > 0;

  // ── aggregate numbers ──
  const allDetails = records.flatMap((g) =>
    g.contracts.map((cd) => ({ ...cd, client: g.client }))
  );
  const totalPlanValue = allDetails.reduce((s, d) => s + (d.contract.planAmount || 0), 0);
  const totalPaid = allDetails.reduce((s, d) => s + (d.contract.totalPaid || 0), 0);
  const totalOutstanding = allDetails.reduce(
    (s, d) => s + Math.max(0, (d.contract.planAmount || 0) - (d.contract.totalPaid || 0)),
    0
  );
  const now = Date.now();
  const allPending = allDetails.flatMap((d) =>
    d.schedules
      .filter((s) => s.status === "pending" || s.status === "overdue")
      .map((s) => ({
        ...s,
        clientName: `${d.client.firstName} ${d.client.lastName}`,
        contractNumber: d.contract.contractNumber,
      }))
  );
  const nextDue = allPending
    .filter((s) => s.dueDate >= now)
    .sort((a, b) => a.dueDate - b.dueDate)[0];
  const overdueList = allPending
    .filter((s) => s.dueDate < now)
    .sort((a, b) => a.dueDate - b.dueDate);
  const lastPayment = allDetails
    .flatMap((d) =>
      d.payments.map((p) => ({
        ...p,
        clientName: `${d.client.firstName} ${d.client.lastName}`,
      }))
    )
    .sort((a, b) => b.paymentDate - a.paymentDate)[0];

  const firstName = overview.name?.split(" ")[0] ?? user?.name?.split(" ")[0];
  const latestLink = linkRequests[0];

  return (
    <div className="space-y-8">
      <PortalShell
        title={firstName ? `Hello, ${firstName}` : "My Account"}
        subtitle={
          overview.email
            ? `Signed in as ${overview.email} · Your balances, payment history, and statements — all in one place.`
            : "Sign in with the email on your plan to see your balances and statements."
        }
      />

      {/* ── Not-linked / guest guidance ── */}
      {!hasPlans && (
        <EmptyState
          icon={overview.isAnonymous || !overview.email ? UserPlus : FileHeart}
          title={
            overview.email
              ? "We couldn’t find plan records for your email yet"
              : "You’re browsing as a guest"
          }
          subtitle={
            overview.email
              ? "Records are matched using the email registered with the office. Send us a linking request and we’ll connect your plan to this account."
              : "Sign in with the email on your Life Plan to view balances, payment schedules, receipts, and statements."
          }
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to={
                overview.isAnonymous || !overview.email
                  ? "/auth?returnTo=%2Fportal"
                  : "/portal/link-account"
              }
            >
              <Button className="h-10 gap-2 rounded-full px-6 text-[13.5px]">
                {overview.isAnonymous || !overview.email
                  ? "Sign in with your email"
                  : "Request account linking"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a
              href="tel:+63287000000"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-[13px] font-semibold text-evergreen"
            >
              <Phone className="h-4 w-4" />
              Call 24/7 Hotline
            </a>
          </div>
        </EmptyState>
      )}

      {/* ── Payment summary band ── */}
      {hasPlans && (
        <Card className="overflow-hidden border-0">
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
            {[
              {
                label: "Plan value",
                value: fmtPeso(totalPlanValue),
                note: `${allDetails.length} active plan${allDetails.length > 1 ? "s" : ""}`,
              },
              { label: "Total paid", value: fmtPeso(totalPaid), note: "all recorded payments" },
              {
                label: "Outstanding balance",
                value: fmtPeso(totalOutstanding),
                note: "plan value less payments",
              },
              {
                label: "Next due",
                value: nextDue ? fmtPeso(nextDue.amount) : "—",
                note: nextDue ? fmtDate(nextDue.dueDate) : "no upcoming schedule",
              },
            ].map((s) => (
              <div key={s.label} className="bg-white p-5 lg:p-6">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-stone">
                  {s.label}
                </p>
                <p className="mt-1.5 truncate font-display text-[22px] font-semibold text-evergreen lg:text-2xl">
                  {s.value}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-stone">{s.note}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Overdue alert ── */}
      {overdueList.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="flex items-center gap-2 text-[13.5px] font-bold text-amber-900">
            <Clock className="h-4 w-4" />
            {overdueList.length} past-due installment
            {overdueList.length > 1 ? "s" : ""} need attention
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">
            {overdueList
              .slice(0, 2)
              .map(
                (s) =>
                  `${s.clientName} — ${s.contractNumber}: ${fmtPeso(s.amount)} was due ${fmtDay(s.dueDate)}`
              )
              .join(" · ")}
            {overdueList.length > 2 && ` · and ${overdueList.length - 2} more`}. Settle
            at any branch or call our hotline for payment arrangements.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link to="/portal/plans">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-amber-400 bg-white text-[12px] font-bold text-amber-900 hover:bg-amber-100"
              >
                View schedules &amp; statement
              </Button>
            </Link>
            <a href="tel:+63287000000">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full text-[12px] font-bold text-amber-900 hover:bg-amber-100"
              >
                <Phone className="h-3.5 w-3.5" />
                Call about my balance
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* ── Plan cards ── */}
      {hasPlans && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-evergreen">
              Your Life Plans
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <SOAButton records={records} label="View statement of account" size="sm" />
              <Link
                to="/portal/plans"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold uppercase tracking-wider text-gold transition-colors hover:text-evergreen"
              >
                Payment history <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {records.map((group) => {
            const c = group.client;
            return (
              <div key={c._id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-evergreen text-[13px] font-bold text-white">
                    {initials(`${c.firstName} ${c.lastName}`)}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold text-ink">
                      {c.firstName} {c.middleName ? `${c.middleName} ` : ""}
                      {c.lastName}
                    </p>
                    <p className="text-[12px] text-stone">
                      {c.city}, {c.province} · {c.contactNumber}
                    </p>
                  </div>
                  <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-stone">
                    Beneficiary: {c.beneficiaryName}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {group.contracts.map((cd) => {
                    const { contract } = cd;
                    const paid = contract.totalPaid || 0;
                    const plan = contract.planAmount || 0;
                    const pct = plan > 0 ? Math.min(100, (paid / plan) * 100) : 0;
                    const pending = cd.schedules.filter(
                      (s) => s.status === "pending" || s.status === "overdue"
                    );
                    const dueSoon = pending
                      .filter((s) => s.dueDate >= now)
                      .sort((a, b) => a.dueDate - b.dueDate)[0];
                    const isLate = pending.some((s) => s.dueDate < now);

                    return (
                      <Link key={contract._id} to="/portal/plans" className="group">
                        <Card className="h-full p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[15px] font-bold text-ink">
                                {contract.planType || "Memorial Plan"}
                              </p>
                              <p className="mt-0.5 font-mono text-[11.5px] text-stone">
                                {contract.contractNumber}
                              </p>
                            </div>
                            <StatusPill map={CONTRACT_PILL} status={contract.contractStatus} />
                          </div>

                          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            {[
                              { l: "Monthly", v: fmtPeso(contract.monthlyAmortization) },
                              { l: "Paid", v: fmtPeso(paid) },
                              { l: "Balance", v: fmtPeso(Math.max(0, plan - paid)) },
                            ].map((s) => (
                              <div key={s.l} className="rounded-xl bg-cream px-1 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-stone">
                                  {s.l}
                                </p>
                                <p className="mt-0.5 text-[13px] font-bold text-evergreen">
                                  {s.v}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4">
                            <div className="flex items-center justify-between text-[10.5px] font-semibold text-stone">
                              <span>Progress</span>
                              <span>{Math.round(pct)}% paid</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream">
                              <div
                                className="h-full rounded-full bg-evergreen transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between text-[12px]">
                            {isLate ? (
                              <span className="font-bold text-red-700">
                                ● Has past-due installments
                              </span>
                            ) : dueSoon ? (
                              <span className="flex items-center gap-1.5 font-semibold text-stone">
                                <CalendarDays className="h-3.5 w-3.5 text-gold" />
                                Next: {fmtDay(dueSoon.dueDate)} · {fmtPeso(dueSoon.amount)}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                                <Info className="h-3.5 w-3.5" />
                                No pending installments
                              </span>
                            )}
                            <ArrowRight className="h-4 w-4 text-gold opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Account ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold text-evergreen">
            Your account
          </h2>
          <Card className="divide-y divide-line">
            <div className="flex items-start gap-3 px-5 py-4">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-evergreen/8 text-evergreen">
                <FileHeart className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-ink">Linked records</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-stone">
                  {hasPlans
                    ? `${records.length} planholder record${records.length > 1 ? "s" : ""}, ${allDetails.length} plan${allDetails.length > 1 ? "s" : ""} matched to ${overview.email}.`
                    : "No plan records are linked to this account yet."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-5 py-4">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-evergreen/8 text-evergreen">
                <Link2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink">Account linking</p>
                {latestLink ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusPill map={REQUEST_PILL} status={latestLink.status} />
                    <span className="text-[11.5px] text-stone">
                      submitted {fmtDate(latestLink.createdAt)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-0.5 text-[12px] leading-relaxed text-stone">
                    Missing a plan? Ask us to connect it to this account.
                  </p>
                )}
                <Link
                  to={overview.isAnonymous || !overview.email ? "/auth?returnTo=%2Fportal" : "/portal/link-account"}
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-evergreen underline underline-offset-2 hover:text-gold"
                >
                  {latestLink ? "View request" : "Request account linking"}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            {lastPayment && (
              <div className="flex items-start gap-3 px-5 py-4">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-evergreen/8 text-evergreen">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-ink">Last payment</p>
                  <p className="mt-0.5 text-[12px] text-stone">
                    {fmtPeso(lastPayment.amount)} · {fmtDate(lastPayment.paymentDate)}{" "}
                    ({lastPayment.clientName})
                    {lastPayment.orNumber ? ` · O.R. ${lastPayment.orNumber}` : ""}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-4 font-display text-xl font-semibold text-evergreen">
            Need help?
          </h2>
          <Card className="space-y-3 px-5 py-5">
            <p className="text-[12.5px] leading-relaxed text-stone">
              Our records team can explain your balance, issue a certified copy of
              a receipt, or print your statement at any branch.
            </p>
            <div className="space-y-2">
              <a
                href="tel:+63287000000"
                className="flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3 transition-all hover:border-evergreen/30 hover:shadow-md"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-evergreen/8 text-evergreen">
                  <Phone className="h-[17px] w-[17px]" />
                </span>
                <span className="text-[12.5px] font-bold text-ink">
                  24/7 hotline — (02) 8-700-0000
                </span>
              </a>
              <Link
                to="/portal/plans"
                className="flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3 transition-all hover:border-evergreen/30 hover:shadow-md"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-evergreen/8 text-evergreen">
                  <FileHeart className="h-[17px] w-[17px]" />
                </span>
                <span className="text-[12.5px] font-bold text-ink">
                  Payment history &amp; statement of account
                </span>
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
