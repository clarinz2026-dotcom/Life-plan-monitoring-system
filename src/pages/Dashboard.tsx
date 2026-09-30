import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageLoading } from "@/components/PageLoading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  FileText,
  TrendingUp,
  AlertTriangle,
  Clock,
  Banknote,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Target,
  CheckCircle2,
  UserPlus,
  Building2,
  BarChart3,
  Calculator,
  BookMarked,
  ChevronRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { useState } from "react";
import { Link } from "react-router";
import { useBranch } from "@/hooks/use-branch";

/**
 * The office works with three payment statuses — Good Payer, Lapsed,
 * Reinstated. The stored status still records how far behind a plan is, which
 * the aging report reads, but every label on this page uses the three-way
 * wording.
 */
const STATUS_LABELS: Record<string, string> = {
  current: "Updated",
  delinquent_30: "30 Days Late",
  delinquent_60: "60 Days Late",
  delinquent_90: "90 Days Late",
  lapsed: "Lapsed",
  fully_paid: "Fully Paid",
};

const STATUS_COLORS: Record<string, string> = {
  current: "terminal-status-current",
  delinquent_30: "terminal-status-delinquent",
  delinquent_60: "terminal-status-delinquent",
  delinquent_90: "terminal-status-claim",
  lapsed: "terminal-status-claim",
  fully_paid: "terminal-status-paid",
};

const CHANNEL_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  check: "Check",
};

const CHANNEL_COLORS: Record<string, string> = {
  cash: "#1b4332",
  gcash: "#007dfe",
  maya: "#00c4b4",
  bank_transfer: "#b45309",
  check: "#716c60",
};

/**
 * Chart text (axis ticks, tooltips) is drawn by recharts into SVG/canvas rather
 * than styled by a class, so the Arial stack has to be passed as a
 * font-family value. Keep it in step with `--font-figures` in `index.css`.
 */
const FIGURES_FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

/** Existing reporting modules, grouped as compact dashboard shortcuts. */
const REPORTING_LINKS = [
  { to: "/reports", icon: BarChart3, label: "Reports", body: "Collections & performance" },
  { to: "/reconciliation", icon: Calculator, label: "Close Register", body: "End-of-day cash tally" },
  { to: "/aging-report", icon: AlertTriangle, label: "Aging Report", body: "30 / 60 / 90 · lapsed" },
  { to: "/or-series", icon: BookMarked, label: "OR Series", body: "Receipt-book register" },
];

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Dashboard() {
  const { queryBranchId, isBranchStaff, branchId } = useBranch();
  const summary = useQuery(api.dashboard.summary, { branchId: queryBranchId });
  const weeklyTrend = useQuery(api.dashboard.weeklyTrend, { branchId: queryBranchId });
  const recentPayments = useQuery(api.dashboard.recentPayments, { branchId: queryBranchId });
  const delinquent = useQuery(api.dashboard.delinquentContracts, { branchId: queryBranchId });
  const branch = useQuery(api.branches.get, branchId ? { branchId } : "skip");
  const updateDelinquency = useMutation(api.delinquency.updateAllContractStatuses);
  const [updatingDelinquency, setUpdatingDelinquency] = useState(false);

  const handleUpdateDelinquency = async () => {
    setUpdatingDelinquency(true);
    try {
      await updateDelinquency();
    } catch (error) {
      console.error("Failed to update delinquency:", error);
    } finally {
      setUpdatingDelinquency(false);
    }
  };

  if (!summary) {
    return <PageLoading label="Loading dashboard" className="min-h-[420px]" />;
  }

  const dayChange =
    summary.todayAmount - summary.yesterdayAmount;
  const dayChangePct =
    summary.yesterdayAmount > 0
      ? Math.round((dayChange / summary.yesterdayAmount) * 100)
      : null;
  const isUp = dayChange >= 0;

  // Channel breakdown sorted by amount
  const channels = Object.entries(summary.byChannel)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount);
  const maxChannelAmount = Math.max(...channels.map((c) => c.amount), 1);

  const delinquentCount =
    (summary.contractsByStatus.delinquent_30 || 0) +
    (summary.contractsByStatus.delinquent_60 || 0) +
    (summary.contractsByStatus.delinquent_90 || 0) +
    (summary.contractsByStatus.lapsed || 0);

  // The three payment statuses, with the stored statuses rolled up. Collapsing
  // them here (instead of listing every stored value) is what keeps the card
  // from showing "Good Payer" twice once current and fully_paid are merged.
  const statusRows = Object.entries(summary.contractsByStatus)
    .map(([status, count]) => ({
      label: STATUS_LABELS[status] || status,
      cls: STATUS_COLORS[status] || "",
      count,
    }))
    .filter((row) => row.count > 0);

  const trendData = weeklyTrend ?? [];

  return (
    <div className="space-y-5 p-5 md:p-8">
      {/* Branch banner → dedicated My Branch card (same existing data) */}
      {isBranchStaff && branch && (
        <Link
          to="/my-branch"
          className="group flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-evergreen text-white">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone">
              My Branch
            </p>
            <p className="truncate font-display text-[19px] font-semibold text-evergreen">
              {branch.name}
            </p>
            <p className="text-[12px] text-stone">
              You are viewing this branch only — {branch.city}, {branch.province}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-3.5 py-1.5 text-[12px] font-bold text-evergreen transition-colors group-hover:bg-evergreen group-hover:text-white">
            Open
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}

      {/* ── Row 1: primary collections + collection progress ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border-0 bg-gradient-to-br from-[#1b4332] to-[#2d6a4f] text-white shadow-sm lg:col-span-2">
          <CardContent className="p-6 md:p-7">
            <div className="mb-3 flex items-center gap-2.5">
              <Banknote className="h-5 w-5 text-white/70" />
              <span className="text-[13px] font-medium uppercase tracking-wider text-white/70">
                Collected Today
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <p className="font-figures text-4xl font-bold tracking-tight md:text-5xl">
                {formatPHP(summary.todayAmount)}
              </p>
              {dayChangePct !== null && (
                <span
                  className={`font-figures flex items-center gap-1 rounded-full px-2.5 py-1 text-[14px] font-semibold ${
                    isUp ? "bg-white/15 text-green-100" : "bg-white/15 text-red-100"
                  }`}
                >
                  {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(dayChangePct)}% vs yesterday
                </span>
              )}
            </div>
            <p className="mt-2 text-[14px] text-white/70">
              {summary.todayPayments} payment{summary.todayPayments !== 1 ? "s" : ""} recorded today
              {summary.yesterdayAmount > 0 && ` · yesterday: ${formatPHP(summary.yesterdayAmount)}`}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
              <div>
                <p className="text-[12px] uppercase tracking-wider text-white/60">This Month</p>
                <p className="font-figures mt-0.5 text-xl font-bold">{formatPHP(summary.monthAmount)}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wider text-white/60">Month Payments</p>
                <p className="font-figures mt-0.5 text-xl font-bold">{summary.monthPayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-line shadow-sm">
          <CardContent className="flex flex-col p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <Target className="h-5 w-5 text-evergreen" />
              <span className="text-[13px] font-medium uppercase tracking-wider text-stone">
                Collection Progress
              </span>
            </div>
            <p className="font-figures text-4xl font-bold text-evergreen">
              {summary.collectionRate}%
            </p>
            <p className="mt-1 text-[13px] text-stone">
              of all contract value collected
            </p>
            <Progress value={summary.collectionRate} className="mt-4 h-2.5" />
            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <div className="flex justify-between text-[14px]">
                <span className="text-stone">Collected</span>
                <span className="font-figures font-semibold text-evergreen">{formatPHP(summary.totalCollected)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-stone">Total Contract Value</span>
                <span className="font-figures font-semibold">{formatPHP(summary.totalContractValue)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-stone">Remaining</span>
                <span className="font-figures font-semibold text-gold">
                  {formatPHP(Math.max(summary.totalContractValue - summary.totalCollected, 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: stat tiles ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-line shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-stone">
                  Total Clients
                </p>
                <p className="font-figures mt-1 text-2xl font-bold">{summary.totalClients}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-evergreen/10">
                <Users className="h-5 w-5 text-evergreen" />
              </div>
            </div>
            <p className="font-figures mt-2 flex items-center gap-1 text-[12px] text-stone">
              <UserPlus className="h-3.5 w-3.5" />
              +{summary.newClientsThisMonth} new this month
            </p>
          </CardContent>
        </Card>

        <Card className="border-line shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-stone">
                  Active Contracts
                </p>
                <p className="font-figures mt-1 text-2xl font-bold">{summary.totalContracts}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage/60">
                <FileText className="h-5 w-5 text-evergreen" />
              </div>
            </div>
            <p className="font-figures mt-2 flex items-center gap-1 text-[12px] text-stone">
              <CheckCircle2 className="h-3.5 w-3.5 text-evergreen" />
              {summary.fullyPaidCount} fully paid
            </p>
          </CardContent>
        </Card>

        <Card className="border-line shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-stone">
                  Late Accounts
                </p>
                <p className={`font-figures mt-1 text-2xl font-bold ${delinquentCount > 0 ? "text-gold" : ""}`}>
                  {delinquentCount}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
                <AlertTriangle className="h-5 w-5 text-gold" />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-stone">
              need follow-up
            </p>
          </CardContent>
        </Card>

        <Card className="border-line shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-stone">
                  Lifetime Collections
                </p>
                <p className="font-figures mt-1 text-2xl font-bold">{formatPHP(summary.totalCollected)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-evergreen/10">
                <Wallet className="h-5 w-5 text-evergreen" />
              </div>
            </div>
            <p className="font-figures mt-2 text-[12px] text-stone">
              {summary.totalPayments} total payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: week chart + payment methods ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border-line shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2.5 text-[16px]">
              <TrendingUp className="h-5 w-5 text-stone" />
              Collections This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.some((d) => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd1" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 13, fontFamily: FIGURES_FONT }}
                    stroke="#716c60"
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fontFamily: FIGURES_FONT }}
                    stroke="#716c60"
                    tickLine={false}
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatPHP(value), "Collected"]}
                    labelStyle={{ fontSize: 14, fontWeight: 600 }}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #d4d2cb",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontFamily: FIGURES_FONT,
                    }}
                  />
                  <Bar dataKey="amount" fill="#1b4332" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[240px] flex-col items-center justify-center text-stone">
                <TrendingUp className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-base">No collections in the last 7 days</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-line shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2.5 text-[16px]">
              <Wallet className="h-5 w-5 text-stone" />
              Payment Methods (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channels.length === 0 ? (
              <p className="py-8 text-center text-base text-stone">
                No payments this month
              </p>
            ) : (
              <div className="space-y-4">
                {channels.map((ch) => (
                  <div key={ch.name}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[14px] font-medium">
                        {CHANNEL_LABELS[ch.name] || ch.name}
                      </span>
                      <span className="font-figures text-[13px] text-stone">
                        {formatPHP(ch.amount)} · {ch.count}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max((ch.amount / maxChannelAmount) * 100, 4)}%`,
                          backgroundColor: CHANNEL_COLORS[ch.name] || "#716c60",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: recent payments + status/attention stack ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border-line shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-[16px]">
              <Clock className="h-5 w-5 text-stone" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* `max-h-96` (24rem) is five rows of this list at its current
                padding and type scale; the other fifteen of the twenty the
                query returns scroll inside the card. */}
            {!recentPayments || recentPayments.length === 0 ? (
              <p className="py-6 text-center text-base text-stone">
                No payments recorded yet
              </p>
            ) : (
              <div className="font-figures max-h-96 space-y-3 overflow-y-auto pr-1">
                {recentPayments.slice(0, 20).map((p) => (
                  <div
                    key={p._id}
                    className="flex items-center justify-between border-b border-line/40 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">
                        {p.client
                          ? `${p.client.lastName}, ${p.client.firstName}`
                          : "Unknown Client"}
                      </p>
                      <p className="text-[13px] text-stone">
                        {p.contract?.contractNumber || "—"} ·{" "}
                        {CHANNEL_LABELS[p.paymentChannel] || p.paymentChannel}
                      </p>
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <p className="text-[15px] font-bold text-evergreen">
                        {formatPHP(p.amount)}
                      </p>
                      <p className="text-[12px] text-stone">
                        {format(new Date(p.paymentDate), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-line shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[16px]">
                Contract Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statusRows.map((group) => (
                  <div key={group.label} className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-[12px] ${group.cls}`}>
                      {group.label}
                    </Badge>
                    <span className="font-figures text-base font-bold">{group.count}</span>
                  </div>
                ))}
                {statusRows.length === 0 && (
                  <p className="py-3 text-center text-base text-stone">
                    No contracts yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-line shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2.5 text-[16px]">
                <AlertTriangle className="h-5 w-5 text-gold" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!delinquent || delinquent.length === 0 ? (
                <p className="py-3 text-center text-base text-stone">
                  All accounts current
                </p>
              ) : (
                <div className="max-h-56 space-y-3 overflow-y-auto">
                  {delinquent.slice(0, 10).map((c) => (
                    <div
                      key={c._id}
                      className="flex items-center justify-between border-b border-line/30 py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium">
                          {c.client
                            ? `${c.client.lastName}, ${c.client.firstName}`
                            : "Unknown"}
                        </p>
                        <p className="font-figures text-[12px] text-stone">
                          {c.contractNumber}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`ml-2 shrink-0 text-[11px] ${STATUS_COLORS[c.contractStatus] || ""}`}
                      >
                        {STATUS_LABELS[c.contractStatus] || c.contractStatus}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Reporting band: existing modules as compact shortcuts ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {REPORTING_LINKS.map((r) => (
          <Link
            key={r.to}
            to={r.to}
            className="group rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-evergreen/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-evergreen/10 text-evergreen">
                <r.icon className="h-[18px] w-[18px]" />
              </span>
              <ChevronRight className="h-4 w-4 text-line transition-colors group-hover:text-evergreen" />
            </div>
            <p className="mt-3.5 font-display text-[16px] font-semibold text-evergreen">
              {r.label}
            </p>
            <p className="mt-0.5 text-[12px] text-stone">{r.body}</p>
          </Link>
        ))}
      </div>

      {/* Existing action kept — end of page, out of the way */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 text-[13px]"
          onClick={handleUpdateDelinquency}
          disabled={updatingDelinquency}
        >
          <RefreshCw className={`h-4 w-4 ${updatingDelinquency ? "animate-spin" : ""}`} />
          {updatingDelinquency ? "Checking..." : "Check Late Accounts"}
        </Button>
      </div>
    </div>
  );
}
