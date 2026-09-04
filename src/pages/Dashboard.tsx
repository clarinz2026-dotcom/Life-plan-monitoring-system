import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  FileText,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Clock,
  Banknote,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

const STATUS_LABELS: Record<string, string> = {
  current: "Current",
  delinquent_30: "30 Days Late",
  delinquent_60: "60 Days Late",
  delinquent_90: "90 Days Late",
  lapsed: "Lapsed",
  fully_paid: "Fully Paid",
  assigned_death_claim: "Death Claim",
};

const STATUS_COLORS: Record<string, string> = {
  current: "terminal-status-current",
  delinquent_30: "terminal-status-delinquent",
  delinquent_60: "terminal-status-delinquent",
  delinquent_90: "terminal-status-claim",
  lapsed: "terminal-status-claim",
  fully_paid: "terminal-status-paid",
  assigned_death_claim: "terminal-status-claim",
};

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Dashboard() {
  const summary = useQuery(api.dashboard.summary);
  const recentPayments = useQuery(api.dashboard.recentPayments);
  const delinquent = useQuery(api.dashboard.delinquentContracts);
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

  const stats = [
    {
      label: "Total Clients",
      value: summary.totalClients,
      icon: Users,
      color: "text-green-600",
    },
    {
      label: "Active Contracts",
      value: summary.totalContracts,
      icon: FileText,
      color: "text-foreground",
    },
    {
      label: "Today's Collections",
      value: formatPHP(summary.todayAmount),
      sub: `${summary.todayPayments} payment${summary.todayPayments !== 1 ? "s" : ""}`,
      icon: Banknote,
      color: "text-green-600",
    },
    {
      label: "Monthly Collections",
      value: formatPHP(summary.monthAmount),
      sub: `${summary.monthPayments} payment${summary.monthPayments !== 1 ? "s" : ""}`,
      icon: TrendingUp,
      color: "text-amber-600",
    },
    {
      label: "Total Collected",
      value: formatPHP(summary.totalCollected),
      sub: `of ${formatPHP(summary.totalContractValue)} total`,
      icon: CreditCard,
      color: "text-green-600",
    },
  ];

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
        <h1 className="text-3xl font-bold mt-1">
          Dashboard
        </h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                  {stat.label}
                </span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              {stat.sub && (
                <p className="text-[13px] text-muted-foreground mt-1">
                  {stat.sub}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
            {!recentPayments || recentPayments.length === 0 ? (
              <p className="text-base text-muted-foreground py-6 text-center">
                No payments recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentPayments.slice(0, 8).map((p) => (
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
                        {p.paymentChannel.toUpperCase().replace("_", " ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-[15px] font-bold text-green-600">
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

        {/* Contract status breakdown + delinquents */}
        <div className="space-y-5">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">
                Contract Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(summary.contractsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[12px] ${STATUS_COLORS[status] || ""}`}
                    >
                      {STATUS_LABELS[status] || status}
                    </Badge>
                    <span className="text-lg font-bold">{count}</span>
                  </div>
                ))}
                {Object.keys(summary.contractsByStatus).length === 0 && (
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Delinquent
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-[13px]"
                  onClick={handleUpdateDelinquency}
                  disabled={updatingDelinquency}
                >
                  <RefreshCw className={`h-4 w-4 ${updatingDelinquency ? "animate-spin" : ""}`} />
                  {updatingDelinquency ? "Updating..." : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!delinquent || delinquent.length === 0 ? (
                <p className="text-base text-muted-foreground text-center py-3">
                  All accounts current
                </p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {delinquent.map((c) => (
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
                        <p className="text-[12px] text-muted-foreground">
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
