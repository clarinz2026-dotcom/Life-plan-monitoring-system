import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { InlineLoading } from "@/components/PageLoading";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/hooks/use-branch";
import { COMPANY, requestKindLabel } from "@/lib/legal";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "submitted", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "refused", label: "Refused" },
] as const;

const STATUS_PILL: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-800 ring-amber-200",
  in_progress: "bg-blue-50 text-blue-800 ring-blue-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  refused: "bg-red-50 text-red-800 ring-red-200",
};

/**
 * Data subject requests.
 *
 * The queue exists because "delete my data" must be answerable by a person,
 * provably: every status change and every resolution note written here is
 * recorded in the audit log with the staff member's name and the time.
 */
export default function PrivacyRequests() {
  const { branchId, isCeoOrAdmin } = useBranch();
  const requests = useQuery(api.privacy.list, {
    branchId: isCeoOrAdmin && branchId ? branchId : undefined,
  });
  const branches = useQuery(api.branches.list);
  const update = useMutation(api.privacy.updateRequest);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Record<string, string>>({});

  if (requests === undefined) return <InlineLoading label="Loading requests" />;

  const rows = statusFilter
    ? requests.filter((r) => r.status === statusFilter)
    : requests;

  const setStatus = async (
    id: Id<"privacy_requests">,
    status: "in_progress" | "completed" | "refused"
  ) => {
    const note = resolution[String(id)]?.trim();
    if (status !== "in_progress" && !note) {
      toast.error("Write what you did before closing the request.");
      return;
    }
    setBusyId(String(id));
    try {
      await update({ requestId: id, status, resolution: note || undefined });
      toast.success("Recorded, and written to the audit log.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusyId(null);
    }
  };

  const route = async (
    id: Id<"privacy_requests">,
    toBranchId: Id<"branches"> | undefined
  ) => {
    setBusyId(String(id));
    try {
      await update({ requestId: id, branchId: toBranchId });
      toast.success("Routed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not route.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 p-5 md:p-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Privacy requests</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Requests from planholders and families asking to see, correct, delete,
          or stop messages about their data. Confirm who the requester is before
          you act, do not delete a record that has payment or receipt history
          (archive it instead, and say so in the note), and record what you did
          &mdash; every change here is written to the audit log.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={statusFilter === tab.key ? "default" : "outline"}
            size="sm"
            className="h-9 text-[13px]"
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
            {tab.key && (
              <span className="ml-1.5 opacity-70">
                {requests.filter((r) => r.status === tab.key).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="px-6 py-10 text-center">
          <ShieldCheck className="mx-auto h-7 w-7 text-emerald-700" aria-hidden="true" />
          <p className="mt-3 text-[15px] font-semibold">
            Nothing waiting here.
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-muted-foreground">
            Requests arrive from the public form linked in the footer of every
            policy page on the website. Families can also make one by calling{" "}
            {COMPANY.hotline}.
          </p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r._id}>
              <Card className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[16px] font-bold">{requestKindLabel(r.kind)}</p>
                    <p className="mt-0.5 text-[13.5px] text-muted-foreground">
                      {r.name} · {r.email}
                      {r.contactNumber ? ` · ${r.contactNumber}` : ""}
                      {r.planNumber ? ` · Plan ${r.planNumber}` : ""}
                      {r.branch ? ` · ${r.branch}` : ""}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      Received{" "}
                      {new Date(r.submittedAt).toLocaleString("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide ring-1 ${
                      STATUS_PILL[r.status] ?? ""
                    }`}
                  >
                    {r.status.replace("_", " ")}
                  </span>
                </div>

                {r.details && (
                  <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[13.5px] leading-relaxed">
                    {r.details}
                  </p>
                )}

                {r.resolution && (
                  <p className="rounded-lg bg-emerald-50 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-emerald-900">
                    <span className="font-bold">Outcome:</span> {r.resolution}
                  </p>
                )}

                <div className="grid gap-3 pt-1 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label
                      htmlFor={`resolution-${r._id}`}
                      className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      What you did (required to close)
                    </label>
                    <textarea
                      id={`resolution-${r._id}`}
                      rows={2}
                      value={resolution[String(r._id)] ?? r.resolution ?? ""}
                      onChange={(e) =>
                        setResolution((prev) => ({
                          ...prev,
                          [String(r._id)]: e.target.value,
                        }))
                      }
                      placeholder="e.g. Planholder visited the branch with a valid ID; record archived, financial history retained for tax."
                      className="mt-1.5 w-full resize-y rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isCeoOrAdmin && (branches ?? []).length > 0 && (
                      <select
                        aria-label={`Route to a branch — ${r.name}`}
                        defaultValue={r.branchId ?? ""}
                        disabled={busyId === String(r._id)}
                        onChange={(e) =>
                          route(
                            r._id,
                            (e.target.value || undefined) as Id<"branches"> | undefined
                          )
                        }
                        className="h-10 rounded-full border border-border bg-background px-4 text-[13px]"
                      >
                        <option value="">Not routed yet</option>
                        {(branches ?? []).map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {r.status !== "in_progress" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 text-[13px]"
                        disabled={busyId === String(r._id)}
                        onClick={() => setStatus(r._id, "in_progress")}
                      >
                        Start work
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[13px]"
                      disabled={busyId === String(r._id)}
                      onClick={() => setStatus(r._id, "refused")}
                    >
                      Cannot do it
                    </Button>
                    <Button
                      size="sm"
                      className="h-10 gap-2 text-[13px]"
                      disabled={busyId === String(r._id)}
                      onClick={() => setStatus(r._id, "completed")}
                    >
                      {busyId === String(r._id) && (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      Done
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}