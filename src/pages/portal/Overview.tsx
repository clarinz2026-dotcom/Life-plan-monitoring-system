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
  SERVICES,
  StatusPill,
  fmtDate,
  fmtDay,
  fmtPeso,
  initials,
  serviceLabel,
} from "./shared";

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
  const requests = overview.requests ?? [];
  const hasPlans = records.length > 0;

  // ── aggregate numbers ──
  const allDetails = records.flatMap((g) =>
    g.contracts.map((cd) => ({ ...cd, client: g.client }))
  );
  const totalPaid = allDetails.reduce((s, d) => s + (d.contract.totalPaid || 0), 0);
  const totalOutstanding = allDetails.reduce(
    (s, d) => s + Math.max(0, (d.contract.planAmount || 0) - (d.contract.totalPaid || 0)),
    0
  );
  const now = Date.now();
  const allPending = allDetails.flatMap((d) =>
    d.schedules
      .filter((s) => s.status === "pending" || s.status === "overdue")
      .map((s) => ({ ...s, clientName: `${d.client.firstName} ${d.client.lastName}`, contractNumber: d.contract.contractNumber }))
  );
  const nextDue = allPending
    .filter((s) => s.dueDate >= now)
    .sort((a, b) => a.dueDate - b.dueDate)[0];
  const overdueList = allPending
    .filter((s) => s.dueDate < now)
    .sort((a, b) => a.dueDate - b.dueDate);
  const lastPayment = allDetails
    .flatMap((d) => d.payments.map((p) => ({ ...p, clientName: `${d.client.firstName} ${d.client.lastName}` })))
    .sort((a, b) => b.paymentDate - a.paymentDate)[0];

  const firstName = overview.name?.split(" ")[0] ?? user?.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <PortalShell
        title={firstName ? `Hello, ${firstName}` : "My Account"}
        subtitle={
          overview.email
            ? `Signed in as ${overview.email} · Everything about your plans and our services, in one place.`
            : "Browse and request every service Evangelist offers."
        }
      />

      {/* ── Not-linked / guest guidance ── */}
      {!hasPlans && (
        <EmptyState
          icon={overview.email ? FileHeart : UserPlus}
          title={
            overview.email
              ? "We couldn’t find plan records for your email yet"
              : "You’re browsing as a guest"
          }
          subtitle={
            overview.email
              ? "Records are matched using the email you registered with the office. If this is your email, visit any branch to confirm your record — or request help below and we’ll link it for you."
              : "Sign in with the email on your Life Plan to view balances, payment schedules, receipts, and more. You can still book services and reach our team as a guest."
          }
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to={overview.email ? "/portal/services?type=account_link" : "/auth?returnTo=%2Fportal"}
            >
              <Button className="h-10 gap-2 rounded-full px-6 text-[13.5px]">
                {overview.email ? "Request account linking" : "Sign in with your email"}
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

      {/* ── Stat band ── */}
      {hasPlans && (
        <Card className="overflow-hidden border-0">
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
            {[
              { label: "Active plans", value: String(allDetails.length), note: `${records.length} planholder${records.length > 1 ? "s" : ""}` },
              { label: "Total paid", value: fmtPeso(totalPaid), note: "all recorded payments" },
              { label: "Outstanding balance", value: fmtPeso(totalOutstanding), note: "plan price less payments" },
              {
                label: nextDue ? "Next due" : "Next due",
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
            {overdueList.length} past-due installment{overdueList.length > 1 ? "s" : ""} need attention
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">
            {overdueList.slice(0, 2).map(
              (s) => `${s.clientName} — ${s.contractNumber}: ${fmtPeso(s.amount)} was due ${fmtDay(s.dueDate)}`
            ).join(" · ")}
            {overdueList.length > 2 && ` · and ${overdueList.length - 2} more`}
            . Settle at any branch or get help paying online.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link to="/portal/services?type=payment_help">
              <Button variant="outline" size="sm" className="h-8 rounded-full border-amber-400 bg-white text-[12px] font-bold text-amber-900 hover:bg-amber-100">
                Request payment help
              </Button>
            </Link>
            <Link to="/portal/plans">
              <Button variant="ghost" size="sm" className="h-8 rounded-full text-[12px] font-bold text-amber-900 hover:bg-amber-100">
                View schedules
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Plan cards ── */}
      {hasPlans && (
        <section className="space-y-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-xl font-semibold text-evergreen">
              Your Life Plans
            </h2>
            <Link
              to="/portal/plans"
              className="inline-flex items-center gap-1 text-[12.5px] font-bold uppercase tracking-wider text-gold transition-colors hover:text-evergreen"
            >
              Full details <ChevronRight className="h-4 w-4" />
            </Link>
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

      {/* ── Quick actions + recent activity ── */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold text-evergreen">
            Everything we offer
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {SERVICES.map((s) => (
              <Link
                key={s.key}
                to={`/portal/services?type=${s.key}`}
                className="group flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3 transition-all hover:border-evergreen/30 hover:shadow-md"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-evergreen/8 text-evergreen transition-colors group-hover:bg-evergreen group-hover:text-white">
                  <s.icon className="h-[17px] w-[17px]" />
                </span>
                <span className="text-[12.5px] font-bold leading-tight text-ink group-hover:text-evergreen">
                  {s.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-xl font-semibold text-evergreen">
              Recent requests
            </h2>
            <Link
              to="/portal/services"
              className="inline-flex items-center gap-1 text-[12.5px] font-bold uppercase tracking-wider text-gold transition-colors hover:text-evergreen"
            >
              Book a service <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {requests.length === 0 ? (
            <Card className="px-5 py-8 text-center">
              <p className="text-[13px] font-semibold text-stone">
                No service requests yet.
              </p>
              <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-stone/80">
                Book a chapel, cremation, eBurol access, or any of our other
                services and track them here.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {requests.slice(0, 3).map((r) => (
                <Card key={r._id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-bold text-ink">
                      {serviceLabel(r.serviceType)}
                    </p>
                    <StatusPill map={REQUEST_PILL} status={r.status} />
                  </div>
                  <p className="mt-1 text-[11.5px] text-stone">
                    {fmtDate(r.createdAt)}
                    {r.branch ? ` · ${r.branch.name}, ${r.branch.city}` : ""}
                    {r.preferredDate ? ` · preferred ${fmtDay(r.preferredDate)}` : ""}
                  </p>
                  {r.staffNotes && (
                    <p className="mt-1.5 rounded-lg bg-cream px-2.5 py-1.5 text-[11.5px] text-evergreen">
                      <strong>Office note:</strong> {r.staffNotes}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
          {lastPayment && (
            <p className="mt-4 rounded-xl bg-evergreen/6 px-4 py-3 text-[12px] text-evergreen">
              Last recorded payment: {fmtPeso(lastPayment.amount)} ·{" "}
              {fmtDate(lastPayment.paymentDate)} ({lastPayment.clientName})
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
