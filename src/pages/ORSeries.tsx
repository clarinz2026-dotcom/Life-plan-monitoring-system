import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollableTable } from "@/components/ScrollableTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookMarked,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Users,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * OR Series Assignation.
 *
 * The register of official-receipt books: which series (e.g. 2026-A) was
 * released to which collector or branch manager, over what number range, and
 * in which branch. It is a BIR-facing control — receipts must be traceable to
 * the person and branch that held the series — so every assignment is written
 * to the audit trail.
 *
 * Visibility mirrors the holder's own reach (enforced on the server, not just
 * hidden in the UI): Finance Staff, the CEO and the Super Admin see the whole
 * company ledger; branch managers and collectors see only the series in their
 * own hands.
 */

const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-terminal-green/10 text-terminal-green border-terminal-green/30",
  },
  consumed: {
    label: "Fully used",
    className: "bg-muted text-muted-foreground border-border",
  },
  revoked: {
    label: "Revoked",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

const POSITION_LABELS: Record<string, string> = {
  branch_manager: "Branch Manager",
  collector: "Collector",
  cashier: "Cashier",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  ceo: "CEO",
  finance_staff: "Finance Staff",
  manager: "Branch Manager",
  cashier: "Cashier",
};

/** Receipt numbers are printed zero-padded, e.g. 00042. */
function padOR(n: number) {
  return String(n).padStart(5, "0");
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const emptyForm = {
  seriesCode: "",
  prefix: "",
  startNumber: "",
  endNumber: "",
  assignedTo: "" as Id<"users"> | "",
  branchId: "" as Id<"branches"> | "",
  notes: "",
};

export default function ORSeries() {
  const access = useQuery(api.orSeries.myAccess);
  const [branchFilter, setBranchFilter] = useState<Id<"branches"> | "">("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "consumed" | "revoked">("all");
  const [search, setSearch] = useState("");

  const series = useQuery(
    api.orSeries.list,
    branchFilter ? { branchId: branchFilter } : {}
  );
  const branches = useQuery(api.branches.publicList);

  // Only assigners load the staff roster — collectors never see it.
  const canAssign = access?.canAssign === true;
  const staff = useQuery(
    api.orSeries.assignableStaff,
    canAssign ? (branchFilter ? { branchId: branchFilter } : {}) : "skip"
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{
    id: Id<"or_series">;
    code: string;
    holder: string;
  } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const assignSeries = useMutation(api.orSeries.assign);
  const revokeSeries = useMutation(api.orSeries.revoke);
  const markConsumed = useMutation(api.orSeries.markConsumed);

  const seesAll = access?.seesAllSeries === true;

  const rows = useMemo(() => {
    const list = series ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!term) return true;
      return (
        r.seriesCode.toLowerCase().includes(term) ||
        r.assignedToName.toLowerCase().includes(term) ||
        r.branchName.toLowerCase().includes(term) ||
        (r.notes ?? "").toLowerCase().includes(term)
      );
    });
  }, [series, statusFilter, search]);

  const summary = useMemo(() => {
    const list = series ?? [];
    const holders = new Set(list.map((r) => r.assignedTo));
    const branchSet = new Set(
      list.map((r) => r.branchId).filter(Boolean) as Id<"branches">[]
    );
    return {
      total: list.length,
      active: list.filter((r) => r.status === "active").length,
      holders: holders.size,
      branches: branchSet.size,
      receipts: list
        .filter((r) => r.status === "active")
        .reduce((sum, r) => sum + r.count, 0),
    };
  }, [series]);

  const openAssign = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = Number(form.startNumber);
    const end = Number(form.endNumber);

    if (!form.seriesCode.trim()) {
      toast.error("Enter the series code.");
      return;
    }
    if (!form.assignedTo) {
      toast.error("Choose who is receiving the series.");
      return;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      toast.error("The start and end numbers must be whole numbers.");
      return;
    }
    if (end < start) {
      toast.error("The end number must be the same as or higher than the start number.");
      return;
    }

    setSaving(true);
    try {
      await assignSeries({
        seriesCode: form.seriesCode.trim(),
        prefix: form.prefix.trim() || undefined,
        startNumber: start,
        endNumber: end,
        assignedTo: form.assignedTo,
        branchId: form.branchId || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success(`Series ${form.seriesCode.trim().toUpperCase()} assigned.`);
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (err) {
      toast.error("Could not assign the series", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setWorkingId(revokeTarget.id);
    try {
      await revokeSeries({ seriesId: revokeTarget.id });
      toast.success(`Series ${revokeTarget.code} revoked.`);
      setRevokeTarget(null);
    } catch (err) {
      toast.error("Could not revoke the series", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setWorkingId(null);
    }
  };

  const handleMarkConsumed = async (id: Id<"or_series">, code: string) => {
    setWorkingId(id);
    try {
      await markConsumed({ seriesId: id });
      toast.success(`Series ${code} marked as fully used.`);
    } catch (err) {
      toast.error("Could not update the series", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">OR Series Assignation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {seesAll
              ? "Every official receipt series in the company — who holds it, and which branch it belongs to."
              : "The official receipt series released to you. Only you and Finance can see this."}
          </p>
        </div>
        {canAssign && (
          <Button onClick={openAssign} className="h-11 px-5 text-[15px]">
            <Plus className="h-4 w-4" />
            Assign Series
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              Series on ledger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              {summary.active} active
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              Receipts in active series
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-terminal-green">
              {summary.receipts.toLocaleString()}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              numbers still issuable
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              {seesAll ? "Holders" : "Your active series"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {seesAll ? summary.holders : summary.active}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              {seesAll ? "staff holding a book" : "in your hands"}
            </p>
          </CardContent>
        </Card>

        {seesAll ? (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                Branches covered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.branches}</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                across the company
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                Your branch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold truncate">
                {rows[0]?.branchName ?? "—"}
              </p>
              <p className="text-[13px] text-muted-foreground mt-1">
                where your series is anchored
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search series, holder or branch…"
            className="h-11 pl-9"
          />
        </div>

        {seesAll && (
          <select
            value={branchFilter}
            onChange={(e) =>
              setBranchFilter(e.target.value as Id<"branches"> | "")
            }
            className="text-[15px] bg-background border border-border rounded-md h-11 px-3"
          >
            <option value="">All branches</option>
            {branches?.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["consumed", "Fully used"],
              ["revoked", "Revoked"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-md px-3 h-9 text-[13.5px] font-medium transition-colors ${
                statusFilter === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-terminal-green" />
            Receipt book ledger
          </CardTitle>
        </CardHeader>
        <CardContent>
          {series === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-terminal-green" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center">
              <BookMarked className="mx-auto h-9 w-9 text-muted-foreground/50" />
              <p className="mt-3 text-[15px] font-medium">
                {series.length === 0
                  ? "No OR series on the ledger yet"
                  : "No series match these filters"}
              </p>
              <p className="mt-1 text-[13.5px] text-muted-foreground">
                {series.length === 0
                  ? canAssign
                    ? "Assign a series to start the register."
                    : "Finance Staff assigns series. Ask them when yours is released."
                  : "Try a different search term or clear the filters."}
              </p>
              {canAssign && series.length === 0 && (
                <Button onClick={openAssign} className="mt-5">
                  <Plus className="h-4 w-4" />
                  Assign Series
                </Button>
              )}
            </div>
          ) : (
            <ScrollableTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Series</TableHead>
                    <TableHead>Number range</TableHead>
                    <TableHead className="text-right">QTY</TableHead>
                    <TableHead>Assigned to</TableHead>
                    {seesAll && <TableHead>Branch</TableHead>}
                    <TableHead>Released by</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    {canAssign && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const meta = STATUS_META[r.status] ?? STATUS_META.active;
                    const holderTitle =
                      POSITION_LABELS[r.assignedToPosition ?? ""] ??
                      ROLE_LABELS[r.assignedToRole ?? ""] ??
                      "Staff";
                    const busy = workingId === r._id;
                    return (
                      <TableRow key={r._id}>
                        <TableCell className="font-semibold whitespace-nowrap">
                          {r.seriesCode}
                          {r.prefix && (
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              ({r.prefix})
                            </span>
                          )}
                          {r.notes && (
                            <p className="mt-0.5 max-w-[220px] text-[12.5px] font-normal text-muted-foreground">
                              {r.notes}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {padOR(r.startNumber)} – {padOR(r.endNumber)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.count.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {r.assignedToName}
                              </p>
                              <p className="text-[12.5px] text-muted-foreground">
                                {holderTitle}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        {seesAll && (
                          <TableCell className="whitespace-nowrap">
                            {r.branchName}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {r.assignedByName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(r.assignedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={meta.className}
                          >
                            {meta.label}
                          </Badge>
                        </TableCell>
                        {canAssign && (
                          <TableCell className="text-right whitespace-nowrap">
                            {r.status === "active" ? (
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-[13px]"
                                  disabled={busy}
                                  onClick={() =>
                                    handleMarkConsumed(r._id, r.seriesCode)
                                  }
                                >
                                  {busy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  Mark used
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-[13px] text-destructive hover:text-destructive"
                                  onClick={() =>
                                    setRevokeTarget({
                                      id: r._id,
                                      code: r.seriesCode,
                                      holder: r.assignedToName,
                                    })
                                  }
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  Revoke
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[12.5px] text-muted-foreground">
                                {r.returnedAt
                                  ? `Returned ${formatDate(r.returnedAt)}`
                                  : "—"}
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}
        </CardContent>
      </Card>

      {/* Assign dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg mx-2 sm:mx-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Assign an OR series
            </DialogTitle>
            <DialogDescription>
              Release a block of official receipt numbers to a collector or
              branch manager. The assignment is recorded in the audit trail and
              cannot be edited later — revoke it and issue a new series instead.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssign} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[14px]">Series code *</Label>
                <Input
                  value={form.seriesCode}
                  onChange={(e) =>
                    setForm({ ...form, seriesCode: e.target.value })
                  }
                  placeholder="2026-A"
                  className="h-11"
                  required
                />
              </div>
              <div>
                <Label className="text-[14px]">Prefix (optional)</Label>
                <Input
                  value={form.prefix}
                  onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                  placeholder="EVF"
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[14px]">Start number *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.startNumber}
                  onChange={(e) =>
                    setForm({ ...form, startNumber: e.target.value })
                  }
                  placeholder="1"
                  className="h-11"
                  required
                />
              </div>
              <div>
                <Label className="text-[14px]">End number *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.endNumber}
                  onChange={(e) =>
                    setForm({ ...form, endNumber: e.target.value })
                  }
                  placeholder="250"
                  className="h-11"
                  required
                />
              </div>
            </div>

            <p className="text-[13px] text-muted-foreground -mt-2">
              {form.startNumber && form.endNumber
                ? Number(form.endNumber) >= Number(form.startNumber)
                  ? `This block holds ${(
                      Number(form.endNumber) - Number(form.startNumber) + 1
                    ).toLocaleString()} receipts (${padOR(
                      Number(form.startNumber)
                    )} – ${padOR(Number(form.endNumber))}).`
                  : "The end number must be the same as or higher than the start number."
                : "First and last receipt number of the block."}
            </p>

            <div>
              <Label className="text-[14px]">Assigned to *</Label>
              <select
                value={form.assignedTo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    assignedTo: e.target.value as Id<"users">,
                  })
                }
                className="text-[15px] bg-background border border-border rounded-md h-11 px-3 w-full"
                required
              >
                <option value="">Select collector or branch manager…</option>
                {staff?.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} —{" "}
                    {POSITION_LABELS[u.position ?? ""] ??
                      ROLE_LABELS[u.role ?? ""] ??
                      "Staff"}
                    {u.branchName !== "—" ? ` @ ${u.branchName}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-[14px]">Branch</Label>
              <select
                value={form.branchId}
                onChange={(e) =>
                  setForm({ ...form, branchId: e.target.value as Id<"branches"> })
                }
                className="text-[15px] bg-background border border-border rounded-md h-11 px-3 w-full"
              >
                <option value="">Use the holder's branch</option>
                {branches?.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-[14px]">Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. BIR ATOR book released 12 Sep 2026"
                className="min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Assign series
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Revoke series {revokeTarget?.code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This takes the series out of {revokeTarget?.holder}&apos;s hands and
              records the return in the audit trail. Issued receipts stay valid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it active</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke series
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
