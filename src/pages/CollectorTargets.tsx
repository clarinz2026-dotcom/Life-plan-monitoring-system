import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Target, TrendingUp, Trophy, Loader2, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Collector Targets.
 *
 * The monthly collection quota a Collector Supervisor sets for each collector
 * in their branch. The quota is only a plan — the "collected" figure beside it
 * is summed from the payments ledger at read time, so what a supervisor sees
 * here can never disagree with the receipts.
 *
 * The whole page is branch-scoped on the server (see convex/collectorTargets.ts):
 * Head Office may pass any branch, everyone else has their own forced, so
 * tampering with `branchId` from the browser exposes no other branch's staff.
 */

const POSITION_LABELS: Record<string, string> = {
  branch_manager: "Branch Manager",
  collector: "Collector",
  cashier: "Cashier",
  collector_supervisor: "Collector Supervisor",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  ceo: "CEO",
  manager: "Branch Manager",
  finance_staff: "Finance Staff",
  cashier: "Cashier",
  collector_supervisor: "Collector Supervisor",
};

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** `YYYY-MM` for the month picker; defaults to the current month. */
function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthValueToTimestamp(value: string) {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).getTime();
}

function monthTitle(value: string) {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

export default function CollectorTargets() {
  const access = useQuery(api.collectorTargets.myAccess);
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [search, setSearch] = useState("");

  const monthTs = monthValueToTimestamp(monthValue);
  const rows = useQuery(api.collectorTargets.list, { month: monthTs });

  const setTarget = useMutation(api.collectorTargets.setTarget);
  const clearTarget = useMutation(api.collectorTargets.clearTarget);

  const canManage = access?.canManageTargets === true;

  const [editing, setEditing] = useState<{
    collectorId: Id<"users">;
    collectorName: string;
    current: number;
  } | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (r) =>
        r.collectorName.toLowerCase().includes(term) ||
        (r.collectorEmail ?? "").toLowerCase().includes(term)
    );
  }, [rows, search]);

  const summary = useMemo(() => {
    const list = rows ?? [];
    const withTarget = list.filter((r) => r.targetAmount > 0);
    const totalTarget = withTarget.reduce((s, r) => s + r.targetAmount, 0);
    const totalCollected = withTarget.reduce((s, r) => s + r.collectedAmount, 0);
    return {
      collectors: list.length,
      targeted: withTarget.length,
      totalTarget,
      totalCollected,
      attainment: totalTarget > 0 ? totalCollected / totalTarget : 0,
      metCount: withTarget.filter((r) => r.collectedAmount >= r.targetAmount).length,
    };
  }, [rows]);

  const openEdit = (row: (typeof filtered)[number]) => {
    setEditing({
      collectorId: row.collectorId,
      collectorName: row.collectorName,
      current: row.targetAmount,
    });
    setAmountDraft(row.targetAmount > 0 ? String(row.targetAmount) : "");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const amount = Number(amountDraft);
    if (!amountDraft.trim() || !Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a target of zero or more.");
      return;
    }
    setSaving(true);
    try {
      await setTarget({
        collectorId: editing.collectorId,
        month: monthTs,
        targetAmount: amount,
      });
      toast.success(`Target set for ${editing.collectorName}.`);
      setEditing(null);
    } catch (err) {
      toast.error("Could not save the target", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await clearTarget({ collectorId: editing.collectorId, month: monthTs });
      toast.success(`Target cleared for ${editing.collectorName}.`);
      setEditing(null);
    } catch (err) {
      toast.error("Could not clear the target", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Collector Targets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canManage
              ? `Monthly collection quota for your team in ${monthTitle(monthValue)}. Collections are read live from the payments ledger.`
              : `Collection progress for ${monthTitle(monthValue)}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="month" className="text-[13px] text-muted-foreground">
            Month
          </Label>
          <Input
            id="month"
            type="month"
            value={monthValue}
            max={currentMonthValue()}
            onChange={(e) => setMonthValue(e.target.value || currentMonthValue())}
            className="h-11 w-[190px]"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              Collectors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.collectors}</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              {summary.targeted} with a target
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              Team target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatPHP(summary.totalTarget)}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              for {monthTitle(monthValue)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-terminal-green">
              {formatPHP(summary.totalCollected)}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              from the payments ledger
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
              Team attainment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                summary.attainment >= 1 ? "text-terminal-green" : ""
              }`}
            >
              {summary.totalTarget > 0 ? pct(summary.attainment) : "—"}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1">
              {summary.metCount} of {summary.targeted} on target
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search collectors…"
          className="h-11 pl-9"
        />
      </div>

      {/* Ledger */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-terminal-green" />
            Collection targets — {monthTitle(monthValue)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-terminal-green" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center">
              <Target className="mx-auto h-9 w-9 text-muted-foreground/50" />
              <p className="mt-3 text-[15px] font-medium">
                {rows.length === 0
                  ? "No collectors in your branch"
                  : "No collectors match this search"}
              </p>
              <p className="mt-1 text-[13.5px] text-muted-foreground">
                {rows.length === 0
                  ? "Collectors appear here once they are assigned a collection position in your branch."
                  : "Try a different search term."}
              </p>
            </div>
          ) : (
            <ScrollableTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collector</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                    <TableHead>Attainment</TableHead>
                    <TableHead>Set by</TableHead>
                    {canManage && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const hasTarget = r.targetAmount > 0;
                    const gap = r.targetAmount - r.collectedAmount;
                    const met = hasTarget && gap <= 0;
                    const title =
                      POSITION_LABELS[r.collectorPosition ?? ""] ??
                      ROLE_LABELS[r.collectorRole ?? ""] ??
                      "Staff";
                    return (
                      <TableRow key={r.collectorId}>
                        <TableCell>
                          <p className="font-medium">{r.collectorName}</p>
                          <p className="text-[12.5px] text-muted-foreground">
                            {title}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {hasTarget ? formatPHP(r.targetAmount) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap font-medium">
                          {formatPHP(r.collectedAmount)}
                          <p className="text-[12px] font-normal text-muted-foreground">
                            {r.paymentCount} payment{r.paymentCount === 1 ? "" : "s"}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {!hasTarget ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className={
                                gap > 0 ? "text-terminal-red" : "text-terminal-green"
                              }
                            >
                              {gap > 0 ? formatPHP(gap) : "Met"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasTarget ? (
                            <div className="min-w-[150px] space-y-1">
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={Math.min(r.attainment * 100, 100)}
                                  className="h-2"
                                />
                                <span
                                  className={`text-[13px] font-semibold tabular-nums ${
                                    met ? "text-terminal-green" : ""
                                  }`}
                                >
                                  {pct(r.attainment)}
                                </span>
                              </div>
                              {met && (
                                <Badge
                                  variant="outline"
                                  className="bg-terminal-green/10 text-terminal-green border-terminal-green/30"
                                >
                                  <Trophy className="h-3 w-3 mr-1" />
                                  On target
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-[13px] text-muted-foreground">
                              No target set
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                          {r.setAt > 0 ? (
                            <>
                              {r.setByName}
                              <p className="text-[12px]">{formatDate(r.setAt)}</p>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-[13px]"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {hasTarget ? "Edit" : "Set"}
                            </Button>
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

      {/* Set / edit target */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-w-md mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editing && editing.current > 0
                ? `Edit ${monthTitle(monthValue)} target`
                : `Set ${monthTitle(monthValue)} target`}
            </DialogTitle>
            <DialogDescription>
              The collection target for {editing?.collectorName}. The
              &ldquo;collected&rdquo; figure is read live from the payments
              ledger, so this only sets the quota to work toward.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div>
              <Label className="text-[14px]">Target amount (₱) *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={amountDraft}
                onChange={(e) => setAmountDraft(e.target.value)}
                placeholder="50000"
                className="h-11"
                required
                autoFocus
              />
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Enter 0 to record a target of zero rather than leaving it unset.
              </p>
            </div>

            <div className="flex justify-between gap-2 pt-1">
              {editing && editing.current > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={saving}
                  onClick={handleClear}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear target
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  Save target
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}