import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  AlertTriangle,
  Clock,
  Calendar,
  FileText,
} from "lucide-react";
import { Fragment } from "react";
import { ScrollableTable } from "@/components/ScrollableTable";
import { useBranch } from "@/hooks/use-branch";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function AgingReport() {
  const { queryBranchId } = useBranch();
  const clientsWithStatus = useQuery(api.clients.listWithStatus, { branchId: queryBranchId });

  // Group by computed status
  const groups = {
    current: [] as any[],
    delinquent_30: [] as any[],
    delinquent_60: [] as any[],
    delinquent_90: [] as any[],
    lapsed: [] as any[],
    fully_paid: [] as any[],
  };

  clientsWithStatus?.forEach((item) => {
    const key = item.computedStatus as keyof typeof groups;
    if (groups[key]) {
      groups[key].push(item);
    }
  });

  const totalOutstanding =
    groups.current.reduce((s, i) => s + (i.contract ? i.contract.planAmount - i.contract.totalPaid : 0), 0) +
    groups.delinquent_30.reduce((s, i) => s + (i.contract ? i.contract.planAmount - i.contract.totalPaid : 0), 0) +
    groups.delinquent_60.reduce((s, i) => s + (i.contract ? i.contract.planAmount - i.contract.totalPaid : 0), 0) +
    groups.delinquent_90.reduce((s, i) => s + (i.contract ? i.contract.planAmount - i.contract.totalPaid : 0), 0) +
    groups.lapsed.reduce((s, i) => s + (i.contract ? i.contract.planAmount - i.contract.totalPaid : 0), 0);

  const handleExportXLSX = async () => {
    const XLSX = await import("xlsx");

    const rows: any[][] = [
      ["Overdue Aging Report"],
      ["Generated", new Date().toLocaleString()],
      [""],
      ["Client", "Plan Type", "Contract #", "Plan Amount", "Total Paid", "Balance", "Status", "Days Since Payment"],
    ];

    const allGroups = [
      { label: "Updated", items: groups.current },
      { label: "30 Days", items: groups.delinquent_30 },
      { label: "60 Days", items: groups.delinquent_60 },
      { label: "90 Days", items: groups.delinquent_90 },
      { label: "Lapsed", items: groups.lapsed },
    ];

    for (const group of allGroups) {
      rows.push([`--- ${group.label} (${group.items.length}) ---`]);
      for (const item of group.items) {
        const c = item.contract;
        if (!c) continue;
        rows.push([
          `${item.client.firstName} ${item.client.lastName}`,
          c.planType,
          c.contractNumber,
          c.planAmount,
          c.totalPaid,
          c.planAmount - c.totalPaid,
          group.label,
          item.daysSincePayment ?? "N/A",
        ]);
      }
      rows.push([""]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Aging Report");
    XLSX.writeFile(wb, `Aging_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded bg-terminal-amber/10 flex items-center justify-center">
            <AlertTriangle className="h-4.5 w-4.5 text-terminal-amber" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Aging Report</h1>
            <p className="text-xs text-muted-foreground">
              Outstanding receivables by delinquency age
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={handleExportXLSX}
        >
          <Download className="h-3.5 w-3.5" /> Export XLSX
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Updated", count: groups.current.length, color: "text-terminal-green" },
          { label: "30 Days", count: groups.delinquent_30.length, color: "text-terminal-amber" },
          { label: "60 Days", count: groups.delinquent_60.length, color: "text-orange-500" },
          { label: "90 Days", count: groups.delinquent_90.length, color: "text-terminal-red" },
          { label: "Lapsed", count: groups.lapsed.length, color: "text-terminal-red" },
        ].map((g) => (
          <Card key={g.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-3xl font-bold ${g.color}`}>{g.count}</p>
              <p className="text-[10px] text-muted-foreground">{g.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outstanding Total */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Outstanding Balance</p>
              <p className="text-3xl font-bold text-terminal-red">{formatPHP(totalOutstanding)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Accounts</p>
              <p className="text-3xl font-bold">
                {groups.current.length + groups.delinquent_30.length + groups.delinquent_60.length + groups.delinquent_90.length + groups.lapsed.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Detailed Aging Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollableTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Client</TableHead>
                  <TableHead className="text-xs">Contract #</TableHead>
                  <TableHead className="text-xs">Plan Type</TableHead>
                  <TableHead className="text-xs">Plan Amount</TableHead>
                  <TableHead className="text-xs">Total Paid</TableHead>
                  <TableHead className="text-xs">Balance</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { label: "Updated", items: groups.current, style: "text-terminal-green" },
                  { label: "30 Days Late", items: groups.delinquent_30, style: "text-terminal-amber" },
                  { label: "60 Days Late", items: groups.delinquent_60, style: "text-orange-500" },
                  { label: "90 Days Late", items: groups.delinquent_90, style: "text-terminal-red" },
                  { label: "Lapsed", items: groups.lapsed, style: "text-terminal-red" },
                ].map((group) =>
                  group.items.length > 0 ? (
                    <Fragment key={group.label}>
                      <TableRow>
                        <TableCell colSpan={8} className={`text-xs font-bold ${group.style} bg-muted/30`}>
                          {group.label} ({group.items.length})
                        </TableCell>
                      </TableRow>
                      {group.items.map((item) => {
                        const c = item.contract;
                        if (!c) return null;
                        const balance = c.planAmount - c.totalPaid;
                        return (
                          <TableRow key={item.client._id}>
                            <TableCell className="text-xs">
                              {item.client.firstName} {item.client.lastName}
                            </TableCell>
                            <TableCell className="text-xs">{c.contractNumber}</TableCell>
                            <TableCell className="text-xs">{c.planType}</TableCell>
                            <TableCell className="text-xs">{formatPHP(c.planAmount)}</TableCell>
                            <TableCell className="text-xs">{formatPHP(c.totalPaid)}</TableCell>
                            <TableCell className="text-xs font-bold text-terminal-red">{formatPHP(balance)}</TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${group.style} bg-transparent border-current`}>
                                {group.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {item.daysSincePayment ?? "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  ) : null
                )}
              </TableBody>
            </Table>
          </ScrollableTable>
        </CardContent>
      </Card>
    </div>
  );
}
