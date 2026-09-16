import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  Users,
  CreditCard,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useState } from "react";
import { useBranch } from "@/hooks/use-branch";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const CHANNEL_COLORS: Record<string, string> = {
  cash: "#1b4332",
  gcash: "#007dfe",
  maya: "#00c4b4",
  bank_transfer: "#b45309",
  check: "#716c60",
};

const STATUS_COLORS: Record<string, string> = {
  current: "#16a34a",
  "30_days": "#b45309",
  "60_days": "#e67e22",
  "90_days": "#b91c1c",
  lapsed: "#7f1d1d",
  fully_paid: "#16a34a",
};

const STATUS_LABELS: Record<string, string> = {
  current: "Current",
  "30_days": "30 Days Late",
  "60_days": "60 Days Late",
  "90_days": "90 Days Late",
  lapsed: "Lapsed",
  fully_paid: "Fully Paid",
};

export default function Reports() {
  const { queryBranchId } = useBranch();
  const collectionSummary = useQuery(api.reports.collectionSummary, { branchId: queryBranchId });
  const byChannel = useQuery(api.reports.byChannel, { branchId: queryBranchId });
  const byCashier = useQuery(api.reports.byCashier, { branchId: queryBranchId });
  const dailyCollections = useQuery(api.reports.dailyCollections, { branchId: queryBranchId });
  const agingReport = useQuery(api.reports.agingReport, { branchId: queryBranchId });
  const monthlyTrend = useQuery(api.reports.monthlyTrend, { branchId: queryBranchId });

  if (!collectionSummary || !byChannel || !agingReport) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-base text-muted-foreground">Loading reports...</p>
      </div>
    );
  }

  const channelData = Object.entries(byChannel).map(([name, data]) => ({
    name: name.replace(/_/g, " ").toUpperCase(),
    value: data.amount,
    count: data.count,
    color: CHANNEL_COLORS[name] || "#716c60",
  }));

  const agingData = Object.entries(agingReport)
    .filter(([key]) => key !== "fully_paid")
    .map(([key, data]) => ({
      name: STATUS_LABELS[key] || key,
      value: data.amount,
      count: data.count,
      color: STATUS_COLORS[key] || "#716c60",
    }));

  const totalReceivables = agingData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Collection Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Financial summary and collection analytics
          </p>
        </div>
        <Button variant="outline" size="default" className="gap-2 h-11 px-5 text-[15px]">
          <Download className="h-5 w-5" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPHP(collectionSummary.today.amount)}</p>
            <p className="text-[13px] text-muted-foreground mt-1">{collectionSummary.today.count} payments</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPHP(collectionSummary.thisWeek.amount)}</p>
            <p className="text-[13px] text-muted-foreground mt-1">{collectionSummary.thisWeek.count} payments</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatPHP(collectionSummary.thisMonth.amount)}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">{collectionSummary.thisMonth.count} payments</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              Year to Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPHP(collectionSummary.yearToDate.amount)}</p>
            <p className="text-[13px] text-muted-foreground mt-1">{collectionSummary.yearToDate.count} payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Collections by Channel */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2.5">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Collections by Channel (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatPHP(value)}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #d4d2cb",
                      borderRadius: "8px",
                      fontSize: "14px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-base">
                No data
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-3">
              {channelData.map((ch) => (
                <div key={ch.name} className="flex items-center gap-2 text-[13px]">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ch.color }}
                  />
                  <span className="text-muted-foreground">{ch.name}</span>
                  <span className="font-medium">{formatPHP(ch.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Collections Chart */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2.5">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Daily Collections (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyCollections && dailyCollections.some((d) => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyCollections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd1" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    stroke="#716c60"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#716c60"
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatPHP(value)}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #d4d2cb",
                      borderRadius: "8px",
                      fontSize: "14px",
                    }}
                  />
                  <Bar dataKey="amount" fill="#1b4332" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-base">
                No collections this month
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aging Report & Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Aging Report */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2.5">
              <Users className="h-5 w-5 text-muted-foreground" />
              Outstanding Receivables Aging
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agingData.map((item) => {
                const percentage = totalReceivables > 0 ? (item.value / totalReceivables) * 100 : 0;
                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between text-[14px]">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="text-[13px] text-muted-foreground">({item.count})</span>
                      </div>
                      <span className="font-medium">{formatPHP(item.value)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium">Total Outstanding</span>
                <span className="font-bold text-lg">{formatPHP(totalReceivables)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2.5">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              Monthly Collections Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend && monthlyTrend.some((m) => m.amount > 0) ? (
              <ResponsiveContainer width="100%" height={270}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd1" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    stroke="#716c60"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#716c60"
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatPHP(value)}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #d4d2cb",
                      borderRadius: "8px",
                      fontSize: "14px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#1b4332"
                    strokeWidth={2}
                    dot={{ fill: "#1b4332", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[270px] flex items-center justify-center text-muted-foreground text-base">
                No trend data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cashier Performance */}
      {byCashier && Object.keys(byCashier).length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold">
              Cashier Performance (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-5 text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                    Cashier
                  </th>
                  <th className="text-right py-3 px-5 text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                    Transactions
                  </th>
                  <th className="text-right py-3 px-5 text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                    Total Collected
                  </th>
                  <th className="text-right py-3 px-5 text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                    Avg. per Transaction
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byCashier)
                  .sort(([, a], [, b]) => b.amount - a.amount)
                  .map(([userId, data]) => (
                    <tr key={userId} className="border-b border-border/30 last:border-0">
                      <td className="py-3 px-5 font-medium text-[15px]">{data.name}</td>
                      <td className="py-3 px-5 text-right text-[14px]">{data.count}</td>
                      <td className="py-3 px-5 text-right font-bold text-green-600 text-[15px]">
                        {formatPHP(data.amount)}
                      </td>
                      <td className="py-3 px-5 text-right text-[14px] text-muted-foreground">
                        {formatPHP(data.count > 0 ? data.amount / data.count : 0)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Last Month Comparison */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-semibold">
            Month-over-Month Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <p className="text-[13px] text-muted-foreground uppercase font-medium">Last Month</p>
              <p className="text-xl font-bold">{formatPHP(collectionSummary.lastMonth.amount)}</p>
              <p className="text-[13px] text-muted-foreground">{collectionSummary.lastMonth.count} payments</p>
            </div>
            <div className="space-y-1">
              <p className="text-[13px] text-muted-foreground uppercase font-medium">This Month</p>
              <p className="text-xl font-bold text-green-600">
                {formatPHP(collectionSummary.thisMonth.amount)}
              </p>
              <p className="text-[13px] text-muted-foreground">{collectionSummary.thisMonth.count} payments</p>
            </div>
          </div>
          {collectionSummary.lastMonth.amount > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              {(() => {
                const change = ((collectionSummary.thisMonth.amount - collectionSummary.lastMonth.amount) / collectionSummary.lastMonth.amount) * 100;
                const isPositive = change >= 0;
                return (
                  <p className={`text-[15px] font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                    {isPositive ? "↑" : "↓"} {Math.abs(change).toFixed(1)}% vs last month
                  </p>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
