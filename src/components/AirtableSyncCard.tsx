import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type {
  AirtableStatus,
  EnsureTablesResult,
  SyncOutcome,
  SyncTableResult,
} from "@/convex/airtable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  TableProperties,
  UploadCloud,
} from "lucide-react";

type TableKey = SyncTableResult["key"];

const TABLES: Array<{ key: TableKey; label: string; hint: string }> = [
  { key: "clients", label: "Clients", hint: "Planholders and their contact details, beneficiaries and branch." },
  { key: "contracts", label: "Contracts", hint: "Memorial plans with amounts, balances and delinquency status." },
  { key: "payments", label: "Payments", hint: "Every collection with channel, O.R. number and recorder." },
  { key: "receipts", label: "Receipts", hint: "Official receipts with number, amount, status and issuer." },
];

const envVarRows = [
  {
    name: "AIRTABLE_TOKEN",
    value: "Airtable personal access token (starts with pat…)",
  },
  {
    name: "AIRTABLE_BASE_ID",
    value: "The base id from your Airtable URL (starts with app…)",
  },
];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function AirtableSyncCard() {
  const checkStatus = useAction(api.airtable.status);
  const createTables = useAction(api.airtable.ensureTables);
  const pushToAirtable = useAction(api.airtable.sync);

  const [status, setStatus] = useState<AirtableStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<null | "tables" | "sync">(null);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const [tableResult, setTableResult] = useState<EnsureTablesResult | null>(null);
  const [selected, setSelected] = useState<TableKey[]>(TABLES.map((t) => t.key));
  const checkedOnce = useRef(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await checkStatus({}));
    } catch (err) {
      setStatus({ state: "error", error: errorMessage(err) });
    } finally {
      setChecking(false);
    }
  }, [checkStatus]);

  useEffect(() => {
    // Guard against React 18/19 StrictMode's double effect in development.
    if (checkedOnce.current) return;
    checkedOnce.current = true;
    void refresh();
  }, [refresh]);

  const handleCreateTables = async () => {
    setBusy("tables");
    setTableResult(null);
    try {
      const result = await createTables({});
      setTableResult(result);
      if (result.state === "done") {
        if (result.created.length > 0) {
          toast.success(`Created ${result.created.join(", ")} in Airtable.`);
        } else if (result.failed.length === 0) {
          toast.info("All Airtable tables already exist.");
        }
        if (result.failed.length > 0) {
          toast.error(result.failed[0].error);
        }
      } else {
        toast.error(result.error);
      }
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const runSync = async (keys: TableKey[]) => {
    if (keys.length === 0) return;
    setBusy("sync");
    setOutcome(null);
    try {
      const result = await pushToAirtable({ tables: keys });
      setOutcome(result);
      if (result.state === "done") {
        const pushed = result.results.reduce((sum, r) => sum + r.pushed, 0);
        const failed = result.results.filter((r) => r.error);
        if (failed.length > 0) {
          toast.error(failed[0].error ?? "Some records could not be synced.");
        } else if (pushed === 0) {
          toast.info("Nothing to sync — Airtable is already up to date.");
        } else {
          toast.success(`${pushed.toLocaleString()} record(s) synced to Airtable.`);
        }
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleTable = (key: TableKey) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const anyBusy = busy !== null || checking;

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded bg-blue-500/10 flex items-center justify-center">
              <TableProperties className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[15px] font-semibold">Airtable</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Mirror clients, contracts, payments and receipts into an Airtable
                base you can share, filter and automate. Records are matched on
                their ID, so syncing again updates rows instead of duplicating them.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {checking ? (
              <Badge variant="outline" className="gap-1.5 text-[12px]">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking…
              </Badge>
            ) : status?.state === "ready" ? (
              <Badge
                variant="outline"
                className="gap-1.5 text-[12px] terminal-status-current"
              >
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1.5 text-[12px] text-muted-foreground"
              >
                Not connected
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void refresh()}
              disabled={anyBusy}
              aria-label="Recheck Airtable connection"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Not configured → exact keys the user must add */}
        {status?.state === "not_configured" && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-[14px] font-medium">
              <AlertTriangle className="h-4 w-4 text-terminal-amber" />
              Add the Airtable keys to finish setup
            </div>
            <p className="text-[13px] text-muted-foreground">
              Open the{" "}
              <span className="font-medium text-foreground">Keys / API keys</span> tab
              and add these two values, then press the refresh button above:
            </p>
            <div className="space-y-2">
              {envVarRows.map((row) => (
                <div
                  key={row.name}
                  className="flex flex-col gap-1 rounded border border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <code className="text-[12.5px] font-semibold">{row.name}</code>
                  <span className="text-[12.5px] text-muted-foreground">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground">
              <li>
                In Airtable, open your base →{" "}
                <span className="text-foreground">Developer hub → Personal access tokens</span>{" "}
                and create a token with scopes{" "}
                <code className="text-[12px]">data.records:read</code>,{" "}
                <code className="text-[12px]">data.records:write</code>,{" "}
                <code className="text-[12px]">schema.bases:read</code> and{" "}
                <code className="text-[12px]">schema.bases:write</code>.
              </li>
              <li>Add this base to the token's access list.</li>
              <li>
                Copy the token, and the base id from the base URL
                (airtable.com/<span className="text-foreground">appXXXXXXXX</span>/…).
              </li>
            </ol>
          </div>
        )}

        {/* Connection problem */}
        {status?.state === "error" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[14px] font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Airtable is not reachable
            </div>
            <p className="text-[13px] text-muted-foreground break-words">
              {status.error}
            </p>
            {status.hint && (
              <p className="text-[13px] text-muted-foreground">{status.hint}</p>
            )}
          </div>
        )}

        {/* Connected */}
        {status?.state === "ready" && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
              <span className="text-muted-foreground">
                Base:{" "}
                <span className="font-medium text-foreground">
                  {status.baseName || status.baseId}
                </span>
              </span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[12px]">
                {status.baseId}
              </code>
              <a
                href={`https://airtable.com/${status.baseId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-blue-600 hover:underline"
              >
                Open in Airtable <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              {TABLES.map((t) => {
                const presence = status.tables.find((p) => p.key === t.key);
                const exists = presence?.exists ?? false;
                return (
                  <span
                    key={t.key}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] ${
                      exists
                        ? "border-border text-foreground"
                        : "border-terminal-amber/40 text-terminal-amber"
                    }`}
                  >
                    {exists ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-terminal-green" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {t.label}
                    {!exists && <span className="text-muted-foreground">· missing</span>}
                  </span>
                );
              })}
            </div>

            {status.missing.length > 0 && (
              <div className="rounded-lg border border-terminal-amber/30 bg-terminal-amber/5 p-4 space-y-3">
                <p className="text-[13.5px]">
                  The base is missing the{" "}
                  <span className="font-medium">
                    {status.missing
                      .map((k) => TABLES.find((t) => t.key === k)?.label ?? k)
                      .join(", ")}
                  </span>{" "}
                  table{status.missing.length > 1 ? "s" : ""}. Create them with the
                  right columns automatically:
                </p>
                <Button
                  onClick={() => void handleCreateTables()}
                  disabled={anyBusy}
                  className="gap-2 h-10"
                >
                  {busy === "tables" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TableProperties className="h-4 w-4" />
                  )}
                  Create tables
                </Button>
                {tableResult?.state === "done" && tableResult.failed.length > 0 && (
                  <div className="space-y-1 text-[12.5px] text-destructive">
                    {tableResult.failed.map((f) => (
                      <p key={f.table}>
                        {f.table}: {f.error}
                      </p>
                    ))}
                    <p className="text-muted-foreground">
                      If this says the token lacks a scope, add{" "}
                      <code>schema.bases:write</code> to your token — or create the
                      tables by hand with the columns listed below.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Sync controls */}
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                Sync to Airtable
              </p>
              <div className="flex flex-wrap gap-2">
                {TABLES.map((t) => {
                  const on = selected.includes(t.key);
                  return (
                    <Button
                      key={t.key}
                      variant={on ? "default" : "outline"}
                      size="sm"
                      className="h-9 text-[13px]"
                      onClick={() => toggleTable(t.key)}
                      disabled={anyBusy}
                      title={t.hint}
                    >
                      {t.label}
                    </Button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void runSync(selected)}
                  disabled={anyBusy || selected.length === 0 || status.missing.length > 0}
                  className="gap-2 h-10"
                >
                  {busy === "sync" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  Sync {selected.length} table{selected.length === 1 ? "" : "s"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(TABLES.map((t) => t.key));
                    void runSync(TABLES.map((t) => t.key));
                  }}
                  disabled={anyBusy || status.missing.length > 0}
                  className="gap-2 h-10"
                >
                  <RefreshCw className={`h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} />
                  Sync everything
                </Button>
              </div>
              {status.missing.length > 0 && (
                <p className="text-[12.5px] text-muted-foreground">
                  Sync is disabled until every table exists in the base.
                </p>
              )}
              <p className="text-[12.5px] text-muted-foreground">
                Up to 500 records per table per run (newest first) — run it again to
                push older records. Your view is limited to your own branch. Rows you
                delete here are not removed from Airtable automatically.
              </p>
            </div>
          </>
        )}

        {/* Sync result */}
        {outcome?.state === "done" && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-[13.5px] font-medium">Last sync</p>
            {outcome.results.map((r) => (
              <div key={r.key} className="text-[13px]">
                <span className="font-medium">{r.label}</span>{" "}
                {r.error ? (
                  <span className="text-destructive">— {r.error}</span>
                ) : (
                  <span className="text-muted-foreground">
                    — {r.pushed.toLocaleString()} of {r.total.toLocaleString()} record
                    {r.total === 1 ? "" : "s"} synced
                    {r.truncated
                      ? " (run again to push the rest)"
                      : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
