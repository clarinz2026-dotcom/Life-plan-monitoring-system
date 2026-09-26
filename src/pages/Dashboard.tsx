import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
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
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { useState } from "react";
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

/** Stored statuses that roll up into each of the three payment statuses. */


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

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
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
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-base text-muted-foreground">Loading dashboard...</p>
      </div>
    );
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
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{greeting()}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")} — here's how the business is doing
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-[13px] shrink-0"
          onClick={handleUpdateDelinquency}
          disabled={updatingDelinquency}
        >
          <RefreshCw className={`h-4 w-4 ${updatingDelinquency ? "animate-spin" : ""}`} />
          {updatingDelinquency ? "Checking..." : "Check Late Accounts"}
        </Button>
      </div>

      {/* Branch context banner (branch staff only) */}
      {isBranchStaff && branch && (
        <div className="flex items-center gap-3 rounded-xl border border-terminal-green/20 bg-terminal-green/10 px-4 py-3">
          <Building2 className="h-5 w-5 text-terminal-green shrink-0" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-terminal-green truncate">
              {branch.name}
            </p>
            <p className="text-[12px] text-muted-foreground">
              You are viewing this branch only — {branch.city}, {branch.province}
            </p>
          </div>
        </div>
      )}

      {/* Hero: Today's collections + day comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 border-border/60 shadow-sm bg-gradient-to-br from-[#1b4332] to-[#2d6a4f] text-white border-0">
          <CardContent className="p-6 md:p-7">
            <div className="flex items-center gap-2.5 mb-3">
              <Banknote className="h-5 w-5 text-white/70" />
              <span className="text-[13px] uppercase tracking-wider text-white/70 font-medium">
                Collected Today
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <p className="font-figures text-4xl md:text-5xl font-bold tracking-tight">
                {formatPHP(summary.todayAmount)}
              </p>
              {dayChangePct !== null && (
                <span
                  className={`font-figures flex items-center gap-1 text-[14px] font-semibold px-2.5 py-1 rounded-full ${
                    isUp ? "bg-white/15 text-green-100" : "bg-white/15 text-red-100"
                  }`}
                >
                  {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(dayChangePct)}% vs yesterday
                </span>
              )}
            </div>
            <p className="text-[14px] text-white/70 mt-2">
              {summary.todayPayments} payment{summary.todayPayments !== 1 ? "s" : ""} recorded today
              {summary.yesterdayAmount > 0 && ` · yesterday: ${formatPHP(summary.yesterdayAmount)}`}
            </p>

            {/* Quick month context */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-white/15">
              <div>
                <p className="text-[12px] uppercase tracking-wider text-white/60">This Month</p>
                <p className="font-figures text-xl font-bold mt-0.5">{formatPHP(summary.monthAmount)}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wider text-white/60">Month Payments</p>
                <p className="font-figures text-xl font-bold mt-0.5">{summary.monthPayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collection progress */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6 flex flex-col">
            <div className="flex items-center gap-2.5 mb-4">
              <Target className="h-5 w-5 text-terminal-green" />
              <span className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                Collection Progress
              </span>
            </div>
            <p className="font-figures text-4xl font-bold text-terminal-green">
              {summary.collectionRate}%
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              of all contract value collected
            </p>
            <Progress value={summary.collectionRate} className="h-2.5 mt-4" />
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Collected</span>
                <span className="font-figures font-semibold text-terminal-green">{formatPHP(summary.totalCollected)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Total Contract Value</span>
                <span className="font-figures font-semibold">{formatPHP(summary.totalContractValue)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-figures font-semibold text-terminal-amber">
                  {formatPHP(Math.max(summary.totalContractValue - summary.totalCollected, 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                  Total Clients
                </p>
                <p className="font-figures text-2xl font-bold mt-1">{summary.totalClients}</p>
              </div>
              <div className="h-11 w-11 rounded-lg bg-terminal-green/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-terminal-green" />
              </div>
            </div>
            <p className="font-figures text-[12px] text-muted-foreground mt-2 flex items-center gap-1">
              <UserPlus className="h-3.5 w-3.5" />
              +{summary.newClientsThisMonth} new this month
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                  Active Contracts
                </p>
                <p className="font-figures text-2xl font-bold mt-1">{summary.totalContracts}</p>
              </div>
              <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="font-figures text-[12px] text-muted-foreground mt-2 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-terminal-green" />
              {summary.fullyPaidCount} fully paid
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                  Late Accounts
                </p>
                <p className={`font-figures text-2xl font-bold mt-1 ${delinquentCount > 0 ? "text-terminal-amber" : ""}`}>
                  {delinquentCount}
                </p>
              </div>
              <div className="h-11 w-11 rounded-lg bg-terminal-amber/15 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-terminal-amber" />
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground mt-2">
              need follow-up
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                  Lifetime Collections
                </p>
                <p className="font-figures text-2xl font-bold mt-1">{formatPHP(summary.totalCollected)}</p>
              </div>
              <div className="h-11 w-11 rounded-lg bg-terminal-green/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-terminal-green" />
              </div>
            </div>
            <p className="font-figures text-[12px] text-muted-foreground mt-2">
              {summary.totalPayments} total payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend chart + payment methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2.5">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
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
              <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-base">No collections in the last 7 days</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment methods */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2.5">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              Payment Methods (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channels.length === 0 ? (
              <p className="text-base text-muted-foreground py-8 text-center">
                No payments this month
              </p>
            ) : (
              <div className="space-y-4">
                {channels.map((ch) => (
                  <div key={ch.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[14px] font-medium">
                        {CHANNEL_LABELS[ch.name] || ch.name}
                      </span>
                      <span className="font-figures text-[13px] text-muted-foreground">
                        {formatPHP(ch.amount)} · {ch.count}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
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

      {/* Recent payments + status breakdown + delinquents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent payments */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* `max-h-96` (24rem) is five rows of this list at its current
                padding and type scale; the other fifteen of the twenty the
                query returns scroll inside the card. */}
            {!recentPayments || recentPayments.length === 0 ? (
              <p className="text-base text-muted-foreground py-6 text-center">
                No payments recorded yet
              </p>
            ) : (
              <div className="font-figures space-y-3 max-h-96 overflow-y-auto pr-1">
                {recentPayments.slice(0, 20).map((p) => (
                  <div
                    key={p._id}
                    className="flex items-center justify-between py-3 border-b border-border/40 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium truncate">
                        {p.client
                          ? `${p.client.lastName}, ${p.client.firstName}`
                          : "Unknown Client"}
                      </p>
                      <p className="text-[13px] text-muted-foreground">
                        {p.contract?.contractNumber || "—"} ·{" "}
                        {CHANNEL_LABELS[p.paymentChannel] || p.paymentChannel}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-[15px] font-bold text-terminal-green">
                        {formatPHP(p.amount)}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
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
          {/* Contract status breakdown */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-semibold">
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
                  <p className="text-base text-muted-foreground text-center py-3">
                    No contracts yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delinquent alerts */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-semibold flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5 text-terminal-amber" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!delinquent || delinquent.length === 0 ? (
                <p className="text-base text-muted-foreground text-center py-3">
                  All accounts current
                </p>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto">
                  {delinquent.slice(0, 10).map((c) => (
                    <div
                      key={c._id}
                      className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium truncate">
                          {c.client
                            ? `${c.client.lastName}, ${c.client.firstName}`
                            : "Unknown"}
                        </p>
                        <p className="font-figures text-[12px] text-muted-foreground">
                          {c.contractNumber}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[11px] shrink-0 ml-2 ${STATUS_COLORS[c.contractStatus] || ""}`}
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
    </div>
  );
}
