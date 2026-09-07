import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useBranch } from "@/hooks/use-branch";
import { Button } from "@/components/ui/button";
import {
  Check,
  Clock,
  ExternalLink,
  Filter,
  Link,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from "lucide-react";

const SERVICE_LABELS: Record<string, string> = {
  chapel_booking: "Chapel & Wake Booking",
  cremation: "Cremation Service",
  hearse_procession: "Hearse & Procession",
  eburol_access: "eBurol Access",
  plan_purchase: "Buy a Plan",
  caskets_urns: "Caskets & Urns",
  death_claim: "Death Claim Filing",
  payment_assistance: "Payment Assistance",
  receipt_copy: "Receipt / SOA Copy",
  account_link: "Account Linking",
  grief_support: "Grief Support",
  general_inquiry: "General Inquiry",
};

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-700 border-amber-200",
  under_review: "bg-blue-50 text-blue-700 border-blue-200",
  scheduled: "bg-purple-50 text-purple-700 border-purple-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

type Request = {
  _id: string;
  serviceType: string;
  contactName: string;
  contactNumber: string;
  contactEmail?: string;
  preferredDate?: number;
  message?: string;
  status: string;
  staffNotes?: string;
  createdAt: number;
  branch: {
    name: string;
    city: string;
    province: string;
    address: string;
    contactNumber: string | null;
  } | null;
  userEmail: string | null;
  userName: string | null;
};

/** Debounce a value by `ms` milliseconds. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function ServiceRequests() {
  const [filter, setFilter] = useState<string>("submitted");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Per-request decline notes: keyed by request _id
  const [declineNotesMap, setDeclineNotesMap] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [linkClientId, setLinkClientId] = useState<string>("");
  const [clientSearchRaw, setClientSearch] = useState("");
  const clientSearch = useDebounced(clientSearchRaw, 300);
  // Reset link selection when search changes
  const prevSearchRef = useRef(clientSearch);
  useEffect(() => {
    if (prevSearchRef.current !== clientSearch) {
      setLinkClientId("");
      prevSearchRef.current = clientSearch;
    }
  }, [clientSearch]);

  const { queryBranchId } = useBranch();
  const requests = useQuery(
    api.portal.staffListRequests,
    filter === "all" ? { branchId: queryBranchId } : { status: filter as "submitted" | "under_review" | "scheduled" | "completed" | "cancelled", branchId: queryBranchId }
  );

  const resolveRequest = useMutation(api.portal.staffResolveRequest);
  const progressRequest = useMutation(api.portal.staffProgressRequest);
  const linkAccount = useMutation(api.portal.staffLinkAccount);
  const clients = useQuery(api.clients.list, { search: clientSearch || undefined, branchId: queryBranchId });

  const handleApprove = useCallback(async (id: string) => {
    setProcessingId(id);
    try {
      await resolveRequest({ requestId: id as Id<"service_requests">, action: "approve" });
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  }, [resolveRequest]);

  const handleSchedule = useCallback(async (id: string) => {
    setProcessingId(id);
    try {
      await progressRequest({ requestId: id as Id<"service_requests">, action: "schedule" });
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  }, [progressRequest]);

  const handleComplete = useCallback(async (id: string) => {
    setProcessingId(id);
    try {
      await progressRequest({ requestId: id as Id<"service_requests">, action: "complete" });
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  }, [progressRequest]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.slice(0, 20);
  }, [clients]);

  const handleLinkAccount = useCallback(async (requestId: string, clientId: string) => {
    setProcessingId(requestId);
    try {
      await linkAccount({
        requestId: requestId as Id<"service_requests">,
        clientId: clientId as Id<"clients">,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
      setLinkClientId("");
      setClientSearch("");
    }
  }, [linkAccount]);

  const handleDecline = useCallback(async (id: string) => {
    setProcessingId(id);
    try {
      await resolveRequest({
        requestId: id as Id<"service_requests">,
        action: "decline",
        staffNotes: declineNotesMap[id] || undefined,
      });
      setDeclineNotesMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  }, [resolveRequest, declineNotesMap]);

  const counts = useQuery(api.portal.staffListRequests, { branchId: queryBranchId });

  const pendingCount = (counts ?? []).filter(
    (r: Request) => r.status === "submitted"
  ).length;

  const rows = (requests ?? []) as Request[];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Service Requests</h1>
        <p className="text-xs text-muted-foreground font-mono">
          &gt; portal.service_requests — Review and resolve client requests
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Pending",
            value: (counts ?? []).filter((r: Request) => r.status === "submitted").length,
            color: "text-amber-600",
          },
          {
            label: "Approved",
            value: (counts ?? []).filter((r: Request) => r.status === "under_review").length,
            color: "text-blue-600",
          },
          {
            label: "Completed",
            value: (counts ?? []).filter((r: Request) => r.status === "completed").length,
            color: "text-green-600",
          },
          {
            label: "Declined",
            value: (counts ?? []).filter((r: Request) => r.status === "cancelled").length,
            color: "text-red-500",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border/60 bg-card p-4"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {s.label}
            </p>
            <p className={`mt-1 text-2xl font-bold font-mono ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {[
          { value: "submitted", label: "Pending" },
          { value: "all", label: "All" },
          { value: "under_review", label: "Approved" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Declined" },
        ].map((tab) => (
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

      {/* Request cards */}
      {requests === undefined ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-12 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No requests match this filter
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Client requests from the portal will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((req) => {
            const expanded = expandedId === req._id;
            const isAccountLink = req.serviceType === "account_link";
            const isPending = req.status === "submitted";

            return (
              <div
                key={req._id}
                className="rounded-xl border border-border/60 bg-card overflow-hidden"
              >
                {/* Request header */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expanded ? null : req._id)
                  }
                  className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/30"
                >
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    {isAccountLink ? (
                      <Link className="h-5 w-5" />
                    ) : (
                      <MessageSquare className="h-5 w-5" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {SERVICE_LABELS[req.serviceType] ?? req.serviceType}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[req.status] ?? ""}`}
                      >
                        {req.status === "under_review" ? "approved" : req.status.replace(/_/g, " ")}
                      </span>
                      {isAccountLink && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                          <Link className="h-2.5 w-2.5" />
                          Account Linking
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {req.contactName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {req.contactNumber}
                      </span>
                      {req.contactEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {req.contactEmail}
                        </span>
                      )}
                      {req.branch && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {req.branch.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(req.createdAt).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {req.userEmail && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Signed in as:{" "}
                        <span className="font-mono text-foreground/70">
                          {req.userEmail}
                        </span>
                        {req.userName && (
                          <span className="ml-1">
                            ({req.userName})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <ChevronIcon open={expanded} />
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-border/50 bg-muted/20 px-4 py-4 space-y-4">
                    {/* Client-submitted details */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {req.preferredDate && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                            Preferred Date
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {new Date(req.preferredDate).toLocaleDateString(
                              "en-PH",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              }
                            )}
                          </p>
                        </div>
                      )}
                      {req.branch && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                            Requested Branch
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {req.branch.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {req.branch.address}, {req.branch.city},{" "}
                            {req.branch.province}
                          </p>
                        </div>
                      )}
                    </div>

                    {req.message && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                          Client Message
                        </p>
                        <p className="mt-1 rounded-lg bg-white border border-border/50 p-3 text-sm leading-relaxed">
                          {req.message}
                        </p>
                      </div>
                    )}

                    {req.staffNotes && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                          Staff Notes
                        </p>
                        <p className="mt-1 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm leading-relaxed text-blue-800">
                          {req.staffNotes}
                        </p>
                      </div>
                    )}

                    {/* Account linking specific info */}
                    {isAccountLink && isPending && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs font-bold text-blue-800 flex items-center gap-1.5 mb-1.5">
                          <Link className="h-3.5 w-3.5" />
                          Account Linking Request
                        </p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          This client wants to link their portal account to an existing
                          planholder record. Search for the matching client below and click
                          "Link Account" to update the client record's email to match
                          the user's sign-in email.
                        </p>
                      </div>
                    )}

                    {/* Action buttons — Account Linking */}
                    {isPending && isAccountLink && (
                      <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1.5">
                            Link to client record *
                          </p>
                          <input
                            type="text"
                            value={clientSearchRaw}
                            onChange={(e) => {
                              setClientSearch(e.target.value);
                              setLinkClientId("");
                            }}
                            placeholder="Search by name or phone..."
                            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          {clientSearchRaw && filteredClients.length > 0 && !linkClientId && (
                            <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-white shadow-sm">
                              {filteredClients.map((c: any) => (
                                <button
                                  key={c._id}
                                  type="button"
                                  onClick={() => {
                                    setLinkClientId(c._id);
                                    setClientSearch(`${c.lastName}, ${c.firstName} — ${c.contactNumber}`);
                                  }}
                                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                                >
                                  <span className="font-medium">
                                    {c.lastName}, {c.firstName}{c.middleName ? ` ${c.middleName}` : ""}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {c.contactNumber}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1.5">
                              Staff Notes (optional)
                            </p>
                            <textarea
                              value={declineNotesMap[req._id] ?? ""}
                              onChange={(e) =>
                                setDeclineNotesMap((prev) => ({ ...prev, [req._id]: e.target.value }))
                              }
                              placeholder="Add a note for the client..."
                              rows={2}
                              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              disabled={processingId === req._id}
                              onClick={() => handleDecline(req._id)}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5"
                              disabled={processingId === req._id || !linkClientId}
                              onClick={() => linkClientId && handleLinkAccount(req._id, linkClientId)}
                            >
                              <Link className="h-3.5 w-3.5" />
                              Link Account
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action buttons — Regular requests (pending) */}
                    {isPending && !isAccountLink && (
                      <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1.5">
                            Staff Notes (optional)
                          </p>
                          <textarea
                            value={declineNotesMap[req._id] ?? ""}
                            onChange={(e) =>
                              setDeclineNotesMap((prev) => ({ ...prev, [req._id]: e.target.value }))
                            }
                            placeholder="Add a note for the client (shown on decline)..."
                            rows={2}
                            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            disabled={processingId === req._id}
                            onClick={() => handleDecline(req._id)}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={processingId === req._id}
                            onClick={() => handleApprove(req._id)}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons — Approved (ready to schedule) */}
                    {req.status === "under_review" && (
                      <div className="flex gap-2 border-t border-border/50 pt-4">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={processingId === req._id}
                          onClick={() => handleSchedule(req._id)}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Mark as Scheduled
                        </Button>
                      </div>
                    )}

                    {/* Action buttons — Scheduled (ready to complete) */}
                    {req.status === "scheduled" && (
                      <div className="flex gap-2 border-t border-border/50 pt-4">
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700"
                          disabled={processingId === req._id}
                          onClick={() => handleComplete(req._id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Mark as Completed
                        </Button>
                      </div>
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
