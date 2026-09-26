import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calculator,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { ScrollableTable } from "@/components/ScrollableTable";
import { useBranch } from "@/hooks/use-branch";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Reconciliation() {
  const { queryBranchId } = useBranch();
  const todaySummary = useQuery(api.reconciliation.todaySummary, { branchId: queryBranchId });
  const records = useQuery(api.reconciliation.list, { branchId: queryBranchId });
  const createReconciliation = useMutation(api.reconciliation.create);
  const reviewReconciliation = useMutation(api.reconciliation.review);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    totalCash: 0,
    totalGCash: 0,
    totalMaya: 0,
    totalBankTransfer: 0,
    totalCheck: 0,
    totalActual: 0,
    notes: "",
  });

  const handleSubmit = async () => {
    const result = await createReconciliation({
      totalCash: form.totalCash,
      totalGCash: form.totalGCash,
      totalMaya: form.totalMaya,
      totalBankTransfer: form.totalBankTransfer,
      totalCheck: form.totalCheck,
      totalActual: form.totalActual,
      notes: form.notes || undefined,
    });

    setOpen(false);
    setForm({
      totalCash: 0,
      totalGCash: 0,
      totalMaya: 0,
      totalBankTransfer: 0,
      totalCheck: 0,
      totalActual: 0,
      notes: "",
    });
  };

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded bg-terminal-green/10 flex items-center justify-center">
            <Calculator className="h-4.5 w-4.5 text-terminal-green" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Close Register</h1>
            <p className="text-xs text-muted-foreground">
              End-of-day cash register balancing
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Close Register
            </Button>
          </DialogTrigger>
          <DialogContent className="mx-2 sm:mx-0 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">
                &gt; End-of-Day Reconciliation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded p-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Today&apos;s Recorded Payments: {formatPHP(todaySummary?.total ?? 0)} ({todaySummary?.count ?? 0} txns)
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Cash: {formatPHP(todaySummary?.byChannel?.cash ?? 0)}</div>
                  <div>GCash: {formatPHP(todaySummary?.byChannel?.gcash ?? 0)}</div>
                  <div>Maya: {formatPHP(todaySummary?.byChannel?.maya ?? 0)}</div>
                  <div>Bank: {formatPHP(todaySummary?.byChannel?.bank_transfer ?? 0)}</div>
                  <div>Check: {formatPHP(todaySummary?.byChannel?.check ?? 0)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Physical Cash Count</Label>
                  <Input
                    type="number"
                    value={form.totalCash || ""}
                    onChange={(e) => setForm({ ...form, totalCash: Number(e.target.value) })}
                    className="text-sm mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">GCash Total</Label>
                  <Input
                    type="number"
                    value={form.totalGCash || ""}
                    onChange={(e) => setForm({ ...form, totalGCash: Number(e.target.value) })}
                    className="text-sm mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Maya Total</Label>
                  <Input
                    type="number"
                    value={form.totalMaya || ""}
                    onChange={(e) => setForm({ ...form, totalMaya: Number(e.target.value) })}
                    className="text-sm mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Bank Transfer Total</Label>
                  <Input
                    type="number"
                    value={form.totalBankTransfer || ""}
                    onChange={(e) => setForm({ ...form, totalBankTransfer: Number(e.target.value) })}
                    className="text-sm mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Check Total</Label>
                  <Input
                    type="number"
                    value={form.totalCheck || ""}
                    onChange={(e) => setForm({ ...form, totalCheck: Number(e.target.value) })}
                    className="text-sm mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Total Actual (All)</Label>
                  <Input
                    type="number"
                    value={form.totalActual || ""}
                    onChange={(e) => setForm({ ...form, totalActual: Number(e.target.value) })}
                    className="text-sm mt-1"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="text-sm mt-1"
                  placeholder="Any discrepancies or notes..."
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSubmit} className="text-xs">
                  Close Register
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today's Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Today&apos;s Collections</p>
            <p className="text-xl font-bold">{formatPHP(todaySummary?.total ?? 0)}</p>
            <p className="text-[10px] text-muted-foreground">{todaySummary?.count ?? 0} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cash</p>
            <p className="text-xl font-bold text-terminal-green">
              {formatPHP(todaySummary?.byChannel?.cash ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Digital</p>
            <p className="text-xl font-bold text-blue-600">
              {formatPHP(
                (todaySummary?.byChannel?.gcash ?? 0) +
                (todaySummary?.byChannel?.maya ?? 0)
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reconciliation History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollableTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Cashier</TableHead>
                  <TableHead className="text-xs">Recorded</TableHead>
                  <TableHead className="text-xs">Actual</TableHead>
                  <TableHead className="text-xs">Variance</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records?.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="text-xs">
                      {new Date(r.reconciliationDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">{r.cashierName}</TableCell>
                    <TableCell className="text-xs">{formatPHP(r.totalRecorded)}</TableCell>
                    <TableCell className="text-xs">{formatPHP(r.totalActual)}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-bold ${
                          r.variance === 0
                            ? "text-terminal-green"
                            : r.variance > 0
                            ? "text-terminal-amber"
                            : "text-terminal-red"
                        }`}
                      >
                        {r.variance >= 0 ? "+" : ""}
                        {formatPHP(r.variance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] ${
                          r.status === "reviewed"
                            ? "bg-terminal-green/10 text-terminal-green border border-terminal-green/20"
                            : r.status === "closed"
                            ? "bg-terminal-amber/10 text-terminal-amber border border-terminal-amber/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.status === "closed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-terminal-green h-7 text-xs"
                          onClick={() => reviewReconciliation({ reconciliationId: r._id })}
                        >
                          Review
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {records?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                      No reconciliation records yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollableTable>
        </CardContent>
      </Card>
    </div>
  );
}
