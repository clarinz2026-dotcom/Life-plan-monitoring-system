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
  FileUp,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { parsePaymentUpload, parseUploadDate } from "@/lib/parsePaymentUpload";
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

/**
 * Mirrors the cap enforced by `payments.archive` / `restore` / `remove`. One
 * call may touch this many payments, so an oversized selection is flagged here
 * instead of failing server-side after the user has already committed to it.
 */
const MAX_BULK_PAYMENTS = 500;

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

  // ── Bulk upload ──────────────────────────────────────────────────────
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<
    { contractNumber: string; amount: number; channel: string; date: string; orNumber: string; remarks: string }[]
  >([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWorking, setUploadWorking] = useState(false);
  const bulkRecordPayments = useMutation(api.payments.bulkRecord);

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
  /**
   * The header box selects as many rows as a single bulk action can carry
   * (MAX_BULK_PAYMENTS), not the whole ledger — so "select all" on a long list
   * can never build a selection the server would refuse.
   */
  const selectableIds = rowIds.slice(0, MAX_BULK_PAYMENTS);
  const capReached = rowIds.length > MAX_BULK_PAYMENTS;
  const selectedSelectableCount = selectableIds.filter((id) =>
    selectedIds.has(id)
  ).length;
  const allSelected =
    selectableIds.length > 0 &&
    selectedSelectableCount === selectableIds.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const selectedAmount = rows
    .filter((p) => selectedIds.has(String(p._id)))
    .reduce((sum, p) => sum + p.amount, 0);
  /** Too many rows for a single reverse/restore/delete call. */
  const overBulkCap = selectedIds.size > MAX_BULK_PAYMENTS;

  /**
   * Select the newest payments — up to one action's worth. Deselecting only
   * clears what the header box picked, so manually chosen rows outside that
   * window are left alone.
   */
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        selectableIds.forEach((id) => next.delete(id));
      } else {
        selectableIds.forEach((id) => next.add(id));
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

  // ── Upload file parsing ──────────────────────────────────────────────
  const handleUploadFile = async (file: File) => {
    setUploadFile(file);
    setUploadError(null);
    setUploadPreview([]);
    try {
      const { rows, warnings } = await parsePaymentUpload(file);
      if (rows.length === 0) {
        setUploadError(warnings.join("\n") || "No payment rows could be read from the file.");
        return;
      }
      setUploadPreview(
        rows.map((row) => ({
          contractNumber: row.contractNumber,
          amount: row.amount,
          channel: row.channel,
          date: parseUploadDate(row.date) || row.date,
          orNumber: row.orNumber,
          remarks: row.remarks,
        })),
      );
      if (warnings.length > 0) setUploadError(warnings.join("\n"));
    } catch (err: any) {
      setUploadError(`Failed to parse file: ${err?.message || "unknown error"}`);
    }
  };

  const handleUploadSubmit = async () => {
    if (uploadPreview.length === 0 || !contracts) return;
    setUploadWorking(true);
    setUploadError(null);
    try {
      // Resolve contract numbers to IDs
      const contractMap = new Map<string, string>();
      for (const c of contracts) contractMap.set(c.contractNumber.toLowerCase(), String(c._id));
      const paymentEntries = [] as typeof uploadPreview;
      const errors: string[] = [];
      for (let i = 0; i < uploadPreview.length; i++) {
        const row = uploadPreview[i];
        const contractId = contractMap.get(row.contractNumber.toLowerCase());
        if (!contractId) {
          errors.push(`Row ${i + 1}: contract "${row.contractNumber}" not found`);
          continue;
        }
        if (!row.amount || row.amount <= 0) {
          errors.push(`Row ${i + 1}: invalid amount`);
          continue;
        }
        paymentEntries.push({ ...row });
      }
      if (errors.length > 0 && paymentEntries.length === 0) {
        setUploadError(errors.join("\n"));
        setUploadWorking(false);
        return;
      }
      const result = await bulkRecordPayments({
        payments: paymentEntries.map((p) => ({
          contractId: contractMap.get(p.contractNumber.toLowerCase()) as any,
          amount: p.amount,
          paymentChannel: (p.channel as any) || "cash",
          paymentDate: p.date ? new Date(p.date).getTime() : Date.now(),
          orNumber: p.orNumber || undefined,
          remarks: p.remarks || undefined,
        })),
      });
      if (result.recorded > 0) {
        toast.success(`Recorded ${result.recorded} payment(s) with ${result.receipts} receipt(s)`);
      }
      if (result.errors.length > 0) {
        setUploadError(result.errors.join("\n"));
      }
      if (result.recorded > 0) setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadPreview([]);
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setUploadWorking(false);
    }
  };

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
            {capReached &&
              ` · the header checkbox picks the newest ${MAX_BULK_PAYMENTS}`}
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
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="default" className="gap-2 h-11 px-5 text-[15px]">
              <FileUp className="h-5 w-5" />
              <span className="hidden sm:inline">Upload Payments</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Bulk Upload Payments</DialogTitle>
              <DialogDescription className="text-sm">
                Upload a CSV or XLSX file. Two formats are accepted: the simple ledger (columns: contractNumber, amount, channel, date, orNumber, remarks) or a statement export with a contract header block followed by a Pay Class / O.R. Date / O.R. No. / Amount table.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-3">
              <div>
                <Label className="text-[14px]">Payment File (CSV or XLSX) *</Label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadFile(file);
                  }}
                  className="text-sm"
                />
              </div>
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {uploadFile.name} ({uploadPreview.length} row{uploadPreview.length !== 1 ? "s" : ""} parsed)
                </p>
              )}
              {uploadError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm text-destructive whitespace-pre-wrap">{uploadError}</p>
                </div>
              )}
              {uploadPreview.length > 0 && (
                <div className="max-h-60 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Contract</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-left">Channel</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">OR #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadPreview.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="px-3 py-1.5">{row.contractNumber}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{formatPHP(row.amount)}</td>
                          <td className="px-3 py-1.5">{row.channel}</td>
                          <td className="px-3 py-1.5">{row.date}</td>
                          <td className="px-3 py-1.5">{row.orNumber || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {uploadPreview.length > 20 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      …and {uploadPreview.length - 20} more rows
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setUploadFile(null); setUploadPreview([]); setUploadError(null); }}>
                Cancel
              </Button>
              <Button onClick={handleUploadSubmit} disabled={uploadWorking || uploadPreview.length === 0} className="gap-2">
                {uploadWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadWorking ? "Uploading…" : `Record ${uploadPreview.length} Payment(s)`}
              </Button>
            </DialogFooter>
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
          {overBulkCap && (
            <span className="w-full text-[13px] font-medium text-destructive">
              Up to {MAX_BULK_PAYMENTS} payments can be processed at once. Narrow
              the selection (or clear and pick a smaller range) and try again.
            </span>
          )}
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
                disabled={isWorking || !canReverse || overBulkCap}
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
                disabled={!canReverse || overBulkCap}
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
                disabled={overBulkCap}
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
                    aria-label={`Select ${selectableIds.length} payments`}
                    title={
                      allSelected
                        ? `Deselect these ${selectableIds.length} payments`
                        : capReached
                          ? `Select the newest ${MAX_BULK_PAYMENTS} payments (the limit for one action)`
                          : `Select all ${selectableIds.length} payments`
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
