import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBranch } from "@/hooks/use-branch";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  current: "Current",
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

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const TABS = [
  { key: "all", label: "All" },
  { key: "current", label: "Current" },
  { key: "delinquent", label: "Delinquent" },
  { key: "lapsed", label: "Lapsed" },
  { key: "fully_paid", label: "Fully Paid" },
];

export default function Contracts() {
  const { queryBranchId } = useBranch();
  const contracts = useQuery(api.contracts.list, { branchId: queryBranchId });
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  const filtered = contracts?.filter((c) => {
    if (filter === "all") return true;
    if (filter === "delinquent")
      return c.contractStatus.startsWith("delinquent");
    return c.contractStatus === filter;
  });

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Contracts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {contracts?.length || 0} total contract{(contracts?.length || 0) !== 1 && "s"}
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={filter === tab.key ? "default" : "outline"}
            size="sm"
            className="h-9 text-[13px]"
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Contract cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {!filtered ? (
          <p className="text-base text-muted-foreground col-span-full py-10 text-center">
            Loading contracts...
          </p>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-14">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-base text-muted-foreground">
              No contracts match this filter
            </p>
          </div>
        ) : (
          filtered.map((c) => {
            const progress = c.planAmount
              ? Math.min((c.totalPaid / c.planAmount) * 100, 100)
              : 0;
            return (
              <Card
                key={c._id}
                className="border-border/60 shadow-sm cursor-pointer hover:border-border transition-colors"
                onClick={() => navigate(`/clients/${c.clientId}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[15px] font-semibold">
                      {c.contractNumber}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[12px] ${
                        STATUS_COLORS[c.contractStatus] || ""
                      }`}
                    >
                      {STATUS_LABELS[c.contractStatus] || c.contractStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Client */}
                  <div className="flex items-center justify-between">
                    <p className="text-[15px]">
                      {c.client
                        ? `${c.client.lastName}, ${c.client.firstName}`
                        : "Unknown"}
                    </p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Plan details */}
                  <div className="grid grid-cols-2 gap-3 text-[14px]">
                    <div>
                      <p className="text-muted-foreground uppercase text-[12px] font-medium">
                        Plan
                      </p>
                      <p className="font-medium">{c.planType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase text-[12px] font-medium">
                        Monthly
                      </p>
                      <p className="font-medium">
                        {formatPHP(c.monthlyAmortization)}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">
                        {formatPHP(c.totalPaid)} / {formatPHP(c.planAmount)}
                      </span>
                      <span className="text-green-600 font-semibold">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <p className="text-[13px] text-muted-foreground">
                    Started: {format(new Date(c.startDate), "MMM d, yyyy")}
                    {c.maturityDate &&
                      ` · Matures: ${format(new Date(c.maturityDate), "MMM d, yyyy")}`}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
