import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBranch } from "@/hooks/use-branch";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Archive,
  ArchiveRestore,
  CreditCard,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ScrollableTable } from "@/components/ScrollableTable";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Payments() {
  const { queryBranchId, isCeoOrAdmin, isManager } = useBranch();
  const [showArchived, setShowArchived] = useState(false);
  const payments = useQuery(api.payments.list, {
    branchId: queryBranchId,
    includeArchived: showArchived,
  });
  const contracts = useQuery(api.contracts.list, { branchId: queryBranchId });
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const recordPayment = useMutation(api.payments.record);

  // ── Bulk selection + reversal ──────────────────────────────────────────
  /** Reversing/restoring a payment is Manager or Head Office work. */
  const canReverse = isCeoOrAdmin || isManager;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const archivePayments = useMutation(api.payments.archive);
  const restorePayments = useMutation(api.payments.restore);
  const removePayments = useMutation(api.payments.remove);

  const rows = payments ?? [];
  const rowIds = rows.map((p) => String(p._id));
  const selectedVisibleCount = rowIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = rowIds.length > 0 && selectedVisibleCount === rowIds.length;
  const someSelected = selectedVisibleCount > 0 && !allSelected;
  const selectedAmount = rows
    .filter((p) => selectedIds.has(String(p._id)))
    .reduce((sum, p) => sum + p.amount, 0);

  /**
   * Select every payment in the list — not just the rows in view. The list is
   * unpaginated, but it is branch-scoped and can be long, so the header box
   * always works on the whole set the user is looking at.
   */
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        rowIds.forEach((id) => next.delete(id));
      } else {
        rowIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const togglePayment = (paymentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  };

  const handleArchive = async () => {
    setIsWorking(true);
    try {
      const result = await archivePayments({
        paymentIds: [...selectedIds] as any,
        reason: archiveReason.trim() || undefined,
      });
      toast.success(
        `Reversed ${result.archived} payment${result.archived !== 1 ? "s" : ""} (${formatPHP(result.amount)}). The plan balance and receipt were updated.`
      );
      setSelectedIds(new Set());
      setArchiveDialogOpen(false);
      setArchiveReason("");
    } catch (error: any) {
      toast.error(error?.message || "Could not reverse the selected payments.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleRestore = async () => {
    setIsWorking(true);
    try {
      const result = await restorePayments({
        paymentIds: [...selectedIds] as any,
      });
      toast.success(
        `Restored ${result.restored} payment${result.restored !== 1 ? "s" : ""}. The amounts are back on their plans.`
      );
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(error?.message || "Could not restore the selected payments.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleRemove = async () => {
    setIsWorking(true);
    try {
      const result = await removePayments({
        paymentIds: [...selectedIds] as any,
      });
      toast.success(
        `Permanently deleted ${result.deleted} payment${result.deleted !== 1 ? "s" : ""}.`
      );
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not delete the selected payments.");
    } finally {
      setIsWorking(false);
    }
  };

  const [form, setForm] = useState({
    contractId: "",
    amount: "",
    paymentChannel: "cash" as
      | "cash"
      | "gcash"
      | "maya"
      | "bank_transfer"
      | "check",
    paymentDate: new Date().toISOString().split("T")[0],
    orNumber: "",
    referenceNumber: "",
    chequeNumber: "",
    bankName: "",
    remarks: "",
  });

  const activeContracts =
    contracts?.filter((c) => c.contractStatus !== "fully_paid") || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await recordPayment({
        contractId: form.contractId as any,
        amount: Number(form.amount),
        paymentChannel: form.paymentChannel,
        paymentDate: form.paymentDate
          ? new Date(form.paymentDate).getTime()
          : Date.now(),
        orNumber: form.orNumber || undefined,
        referenceNumber: form.referenceNumber || undefined,
        chequeNumber: form.chequeNumber || undefined,
        bankName: form.bankName || undefined,
        remarks: form.remarks || undefined,
      });
      toast.success(`Payment recorded! Receipt: ${result.receiptNumber}`);
      setDialogOpen(false);
      setForm({
        contractId: "",
        amount: "",
        paymentChannel: "cash",
        paymentDate: new Date().toISOString().split("T")[0],
        orNumber: "",
        referenceNumber: "",
        chequeNumber: "",
        bankName: "",
        remarks: "",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to record payment"
      );
    }
  };

  const inputClass = "text-base bg-background border-border h-11";

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">
            Payments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {showArchived ? "All payments" : "Payments in the ledger"} ·{" "}
            {rows.length} record{rows.length !== 1 && "s"}
            {showArchived &&
              ` · ${rows.filter((p) => p.archivedAt).length} reversed`}
          </p>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            className="mt-2 h-8 gap-1.5 text-[12.5px]"
            onClick={() => {
              setShowArchived(!showArchived);
              setSelectedIds(new Set());
            }}
            title="Reversed payments stay in the ledger for the audit trail"
          >
            <Archive className="h-3.5 w-3.5" />
            {showArchived ? "Showing reversed" : "Show reversed"}
          </Button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="default" className="gap-2 h-11 px-5 text-[15px]">
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">Record Payment</span>
              <span className="sm:hidden">Record</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Record Payment
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-3">
              <div>
                <Label className="text-[14px]">Contract *</Label>
                <select
                  value={form.contractId}
                  onChange={(e) =>
                    setForm({ ...form, contractId: e.target.value })
                  }
                  className="text-base bg-background border border-border rounded-md h-11 px-3 w-full"
                  required
                >
                  <option value="">Select contract...</option>
                  {activeContracts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.contractNumber} — {c.client?.lastName},{" "}
                      {c.client?.firstName} — {c.planType} (
                      {formatPHP(c.planAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[14px]">Amount (₱) *</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <Label className="text-[14px]">Channel *</Label>
                  <select
                    value={form.paymentChannel}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paymentChannel: e.target.value as typeof form.paymentChannel,
                      })
                    }
                    className="text-base bg-background border border-border rounded-md h-11 px-3 w-full"
                  >
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="maya">Maya</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="check">Check</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-[14px]">Payment Date *</Label>
                <Input
                  type="date"
                  value={form.paymentDate}
                  onChange={(e) =>
                    setForm({ ...form, paymentDate: e.target.value })
                  }
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Reference Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {form.paymentChannel === "check" && (
                    <>
                      <div>
                        <Label className="text-[14px]">Cheque Number</Label>
                        <Input
                          value={form.chequeNumber}
                          onChange={(e) =>
                            setForm({ ...form, chequeNumber: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <Label className="text-[14px]">Bank Name</Label>
                        <Input
                          value={form.bankName}
                          onChange={(e) =>
                            setForm({ ...form, bankName: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                    </>
                  )}
                  {(form.paymentChannel === "gcash" ||
                    form.paymentChannel === "maya" ||
                    form.paymentChannel === "bank_transfer") && (
                    <div className="col-span-2">
                      <Label className="text-[14px]">Reference Number</Label>
                      <Input
                        value={form.referenceNumber}
                        onChange={(e) =>
                          setForm({ ...form, referenceNumber: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-[14px]">Remarks</Label>
                <Input
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                  placeholder="Optional notes..."
                  className={inputClass}
                />
              </div>

              <Button type="submit" className="w-full h-12 text-[15px] font-semibold">
                Record Payment & Issue Receipt
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selection bar — appears only once something is ticked */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <span className="text-[14px] font-semibold">
            {selectedIds.size} payment{selectedIds.size !== 1 ? "s" : ""} selected ·{" "}
            {formatPHP(selectedAmount)}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => setSelectedIds(new Set())}
              className="h-10 text-[14px]"
            >
              Clear
            </Button>

            {showArchived ? (
              <Button
                variant="default"
                size="default"
                className="h-10 gap-2 text-[14px]"
                onClick={handleRestore}
                disabled={isWorking || !canReverse}
                title={
                  canReverse
                    ? "Put these payments back on their plans"
                    : "Only a Branch Manager or Head Office can restore a payment"
                }
              >
                {isWorking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArchiveRestore className="h-4 w-4" />
                )}
                Restore ({selectedIds.size})
              </Button>
            ) : (
              <Button
                variant="outline"
                size="default"
                className="h-10 gap-2 text-[14px]"
                onClick={() => setArchiveDialogOpen(true)}
                disabled={!canReverse}
                title={
                  canReverse
                    ? "Reverse from the ledger without erasing the record"
                    : "Only a Branch Manager or Head Office can reverse a payment"
                }
              >
                <Archive className="h-4 w-4" />
                Reverse ({selectedIds.size})
              </Button>
            )}

            {isCeoOrAdmin && (
              <Button
                variant="destructive"
                size="default"
                className="h-10 gap-2 text-[14px]"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Payment table */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          <ScrollableTable>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      allSelected ? true : someSelected ? "indeterminate" : false
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label={`Select all ${rows.length} payments in the ledger`}
                    title={
                      allSelected
                        ? `Deselect all ${rows.length} payments`
                        : `Select all ${rows.length} payments`
                    }
                  />
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Date
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Client
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Contract
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Channel
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  OR #
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium text-right">
                  Amount
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!payments ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-base">
                    Loading payments...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-base text-muted-foreground">
                      No payments recorded yet
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => {
                  const rowId = String(p._id);
                  const isSelected = selectedIds.has(rowId);
                  return (
                  <TableRow
                    key={p._id}
                    data-state={isSelected ? "selected" : undefined}
                    className={`hover:bg-muted/50 ${
                      p.archivedAt ? "opacity-70" : ""
                    }`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => togglePayment(rowId)}
                        aria-label={`Select payment of ${formatPHP(p.amount)}`}
                      />
                    </TableCell>
                    <TableCell className="text-[14px]">
                      {format(new Date(p.paymentDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <p className="text-[15px]">
                        {p.client
                          ? `${p.client.lastName}, ${p.client.firstName}`
                          : "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-[14px]">
                      {p.contract?.contractNumber || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[12px]">
                        {p.paymentChannel.toUpperCase().replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[14px] text-muted-foreground">
                      {p.orNumber || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-bold text-[15px] ${
                          p.archivedAt
                            ? "text-muted-foreground line-through"
                            : "text-terminal-green"
                        }`}
                      >
                        {formatPHP(p.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {p.archivedAt ? (
                        <Badge
                          variant="outline"
                          className="text-[12px] text-muted-foreground"
                        >
                          Reversed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[12px] terminal-status-paid"
                        >
                          Posted
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </ScrollableTable>
        </CardContent>
      </Card>

      {/* Reverse (soft delete) confirmation */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Reverse {selectedIds.size} payment
              {selectedIds.size !== 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p className="text-[15px]">
                {formatPHP(selectedAmount)} will come off the plan balance and
                the matching receipt will be cancelled:
              </p>
              <p className="text-[13px]">
                plan total paid · contract status · official receipt
              </p>
              <p className="text-[13px] text-stone">
                Nothing is erased. The payment stays in the ledger marked
                “Reversed”, keeps its place in the audit trail, and can be
                restored at any time.
              </p>
              <div className="pt-1">
                <Label className="text-[13px]">Reason (optional)</Label>
                <Input
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. wrong amount recorded"
                  className="h-10 text-[14px]"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
              disabled={isWorking}
              className="h-11 text-[14px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchive}
              disabled={isWorking}
              className="gap-2 h-11 text-[14px]"
            >
              {isWorking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              Reverse {selectedIds.size} payment
              {selectedIds.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Permanently delete {selectedIds.size} payment
              {selectedIds.size !== 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p className="text-[15px]">
                This erases the payment, its receipt, and its place in the
                audit trail. The amount still comes off the plan balance.
              </p>
              <p className="text-[13px] text-stone">
                Past collections, reports, and the cashier’s reconciliations
                will no longer show these {formatPHP(selectedAmount)}. If you
                only need to correct an entry, use Reverse instead.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isWorking}
              className="h-11 text-[14px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isWorking}
              className="gap-2 h-11 text-[14px]"
            >
              {isWorking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete {selectedIds.size} payment
              {selectedIds.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
