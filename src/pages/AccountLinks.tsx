import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronDown,
  Filter,
  Link2,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type LinkRequest = {
  _id: Id<"service_requests">;
  contactName: string;
  contactNumber: string;
  contactEmail?: string;
  message?: string;
  staffNotes?: string;
  status: "submitted" | "under_review" | "completed" | "cancelled";
  createdAt: number;
  userEmail: string | null;
  userName: string | null;
  branch: { name: string; city: string; province: string } | null;
};

const TABS = [
  { value: "submitted", label: "Pending" },
  { value: "all", label: "All" },
  { value: "completed", label: "Linked" },
  { value: "cancelled", label: "Declined" },
] as const;

function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Staff queue for account-linking requests: verify the requester against a
 * planholder record, then link the two (which points the client record's email
 * at the requester's auth account and makes their plans appear in the portal).
 */
export default function AccountLinks() {
  const [filter, setFilter] = useState<(typeof TABS)[number]["value"]>("submitted");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [declineNotes, setDeclineNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const requests = useQuery(api.portal.staffListLinkRequests, {
    status: filter === "all" ? undefined : filter,
  });
  const allCounts = useQuery(api.portal.staffListLinkRequests, {});

  const linkAccount = useMutation(api.portal.staffLinkAccount);
  const declineRequest = useMutation(api.portal.staffDeclineLinkRequest);

  // Candidate planholder records for the selected request, matched on the
  // requester's name so staff can confirm the right one.
  const candidates = useQuery(
    api.clients.list,
    expandedId ? { search: search.trim() || undefined } : "skip"
  );

  const rows = (requests ?? []) as LinkRequest[];
  const pendingCount = (allCounts ?? []).filter(
    (r) => r.status === "submitted"
  ).length;

  const handleLink = async (requestId: Id<"service_requests">) => {
    if (!selectedClientId) {
      toast.error("Pick the planholder record to link first");
      return;
    }
    setBusyId(requestId);
    try {
      const res = await linkAccount({
        requestId,
        clientId: selectedClientId as Id<"clients">,
      });
      toast.success(`Linked to ${res.clientName}`, {
        description: "Their plans and payments now appear in the client portal.",
      });
      setSelectedClientId("");
      setSearch("");
      setExpandedId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link account");
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (requestId: Id<"service_requests">) => {
    setBusyId(requestId);
    try {
      await declineRequest({
        requestId,
        staffNotes: declineNotes.trim() || undefined,
      });
      toast.success("Request declined");
      setDeclineNotes("");
      setExpandedId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not decline");
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    pending: (allCounts ?? []).filter((r) => r.status === "submitted").length,
    linked: (allCounts ?? []).filter((r) => r.status === "completed").length,
    declined: (allCounts ?? []).filter((r) => r.status === "cancelled").length,
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Linking</h1>
        <p className="font-mono text-xs text-muted-foreground">
          &gt; portal.account_link — Verify a planholder and connect their portal
          account
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pending", value: counts.pending, color: "text-amber-600" },
          { label: "Linked", value: counts.linked, color: "text-emerald-600" },
          { label: "Declined", value: counts.declined, color: "text-red-500" },
          {
            label: "Total",
            value: (allCounts ?? []).length,
            color: "text-foreground",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border/60 bg-card p-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className={`mt-1 font-mono text-2xl font-bold ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
            {tab.value === "submitted" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {requests === undefined ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-12 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No requests match this filter
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Linking requests filed from the client portal will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((req) => {
            const expanded = expandedId === req._id;
            const isOpen = req.status === "submitted" || req.status === "under_review";
            return (
              <div
                key={req._id}
                className="overflow-hidden rounded-xl border border-border/60 bg-card"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(expanded ? null : req._id);
                    setSelectedClientId("");
                    setDeclineNotes("");
                    setSearch(req.contactName);
                  }}
                  className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/30"
                >
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {req.contactName}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          req.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : req.status === "cancelled"
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {req.status === "completed"
                          ? "Linked"
                          : req.status === "cancelled"
                            ? "Declined"
                            : "Pending"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {req.contactNumber}
                      {req.contactEmail ? ` · ${req.contactEmail}` : ""}
                      {req.branch ? ` · ${req.branch.name}, ${req.branch.city}` : ""}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">
                      {fmtDateTime(req.createdAt)}
                      {req.userEmail ? ` · portal: ${req.userEmail}` : ""}
                    </p>
                  </div>
                  <ChevronDown
                    className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expanded && (
                  <div className="space-y-4 border-t border-border/60 p-4">
                    {req.message && (
                      <div className="rounded-lg bg-muted/40 p-3 text-xs">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Message from client
                        </p>
                        <p className="mt-1 text-foreground">{req.message}</p>
                      </div>
                    )}

                    {req.staffNotes && (
                      <div className="rounded-lg bg-muted/40 p-3 text-xs">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Office note
                        </p>
                        <p className="mt-1 text-foreground">{req.staffNotes}</p>
                      </div>
                    )}

                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <p>
                        <span className="text-muted-foreground">
                          Portal account:{" "}
                        </span>
                        <span className="font-mono">
                          {req.userEmail || "— (no email on account)"}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Registered name:{" "}
                        </span>
                        <span className="font-semibold">{req.contactName}</span>
                      </p>
                    </div>

                    {isOpen ? (
                      <>
                        {/* Planholder picker */}
                        <div className="space-y-2">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Link to planholder record
                          </p>
                          <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              placeholder="Search by name or contact number"
                              className="h-9 w-full rounded-lg border border-border/60 bg-background pl-9 pr-3 text-xs outline-none focus:border-primary/50"
                            />
                          </div>
                          <div className="max-h-56 space-y-1.5 overflow-y-auto">
                            {candidates === undefined ? (
                              <p className="py-3 text-center text-xs text-muted-foreground">
                                Loading records…
                              </p>
                            ) : candidates.length === 0 ? (
                              <p className="py-3 text-center text-xs text-muted-foreground">
                                No planholder records match that search.
                              </p>
                            ) : (
                              candidates.slice(0, 20).map((c) => {
                                const active = selectedClientId === c._id;
                                return (
                                  <button
                                    key={c._id}
                                    type="button"
                                    onClick={() => setSelectedClientId(c._id)}
                                    className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-xs transition-colors ${
                                      active
                                        ? "border-primary bg-primary/5"
                                        : "border-border/60 hover:bg-muted/40"
                                    }`}
                                  >
                                    <span
                                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                                        active
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {c.firstName[0]}
                                      {c.lastName[0]}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate font-semibold">
                                        {c.lastName}, {c.firstName}
                                        {c.middleName ? ` ${c.middleName}` : ""}
                                      </span>
                                      <span className="block truncate text-muted-foreground">
                                        {c.contactNumber || "no contact"} ·{" "}
                                        {c.city || "no city"}
                                      </span>
                                    </span>
                                    {active && (
                                      <Check className="h-4 w-4 shrink-0 text-primary" />
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <label className="block">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Decline reason (optional)
                          </span>
                          <input
                            value={declineNotes}
                            onChange={(e) => setDeclineNotes(e.target.value)}
                            placeholder="e.g. name doesn't match any record — asked to visit the branch"
                            className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-xs outline-none focus:border-primary/50"
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={busyId === req._id || !selectedClientId}
                            onClick={() => handleLink(req._id)}
                          >
                            {busyId === req._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                            Approve &amp; link account
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === req._id}
                            onClick={() => handleDecline(req._id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                            Decline
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {req.status === "completed"
                          ? "This account has been linked."
                          : "This request was declined."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
