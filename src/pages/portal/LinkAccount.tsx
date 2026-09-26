import { api } from "@/convex/_generated/api";
import { PageLoading } from "@/components/PageLoading";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Check, FileHeart, Loader2, Send, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  Card,
  PortalShell,
  REQUEST_PILL,
  StatusPill,
  fmtDate,
  fmtDay,
} from "./shared";

/**
 * Account linking: the planholder asks the office to connect their portal
 * account to their plan records. Staff review it on the Account Linking page.
 */
export default function LinkAccount() {
  const overview = useQuery(api.portal.myOverview);
  const myRequests = useQuery(api.portal.myLinkRequests);
  // `branches.publicList` — the portal account is not staff, so the staff-only
  // `branches.list` would reject this query and leave the picker empty.
  const branches = useQuery(api.branches.publicList);
  const submit = useMutation(api.portal.requestAccountLink);
  const cancel = useMutation(api.portal.cancelMyLinkRequest);

  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [branchId, setBranchId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Prefill from the planholder record (when one is already matched) and the
  // signed-in auth account.
  useEffect(() => {
    const first = overview?.records?.[0];
    if (first) {
      const c = first.client;
      setContactName((v) => v || `${c.firstName} ${c.lastName}`);
      setContactNumber((v) => v || c.contactNumber);
    }
    if (overview?.email) {
      setContactEmail((v) => v || overview.email!);
    }
  }, [overview]);

  const activeBranches = branches ?? [];
  const hasRecords = (overview?.records?.length ?? 0) > 0;
  const requests = myRequests ?? [];
  const openRequest = requests.find(
    (r) => r.status === "submitted" || r.status === "under_review"
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!contactName.trim() || !contactNumber.trim()) {
      setError("Please provide your name and a contact number.");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        branchId: (branchId || undefined) as Id<"branches"> | undefined,
        contactName: contactName.trim(),
        contactNumber: contactNumber.trim(),
        contactEmail: contactEmail.trim() || undefined,
        message: message.trim() || undefined,
      });
      toast.success("Request sent", {
        description:
          "Our records team will verify your details and link your plan during office hours.",
      });
      setMessage("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: Id<"service_requests">) => {
    setCancellingId(id);
    try {
      await cancel({ requestId: id });
      toast.success("Request cancelled");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not cancel request."
      );
    } finally {
      setCancellingId(null);
    }
  };

  if (overview === undefined) {
    return <PageLoading label="Loading your plan" className="min-h-[50vh]" />;
  }
  if (overview === null) return null;

  return (
    <div className="space-y-8">
      <PortalShell
        title="Link My Account"
        subtitle="Already a planholder? Connect your plans to this portal account so your balances, payment history, and statements appear here."
      />

      {/* Already linked */}
      {hasRecords ? (
        <Card className="flex flex-wrap items-center gap-4 px-6 py-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <Check className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-ink">
              Your account is already linked
            </p>
            <p className="mt-0.5 text-[12.5px] text-stone">
              We matched your email to {overview.records.length} planholder
              record{overview.records.length > 1 ? "s" : ""}. Everything is on
              your plans page.
            </p>
          </div>
          <Link to="/portal/plans">
            <Button className="h-10 rounded-full px-6 text-[13.5px]">
              View my plans &amp; statement
            </Button>
          </Link>
        </Card>
      ) : null}

      {/* Guest guidance */}
      {overview.isAnonymous || !overview.email ? (
        <Card className="px-6 py-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-evergreen/8 text-evergreen">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="mt-4 text-[15.5px] font-bold text-ink">
            Sign in with your email first
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-stone">
            Records are matched using the email registered with our office, so
            account linking needs a signed-in email account — not a guest
            session.
          </p>
          <Link to="/auth?returnTo=%2Fportal%2Flink-account">
            <Button className="mt-5 h-10 rounded-full px-6 text-[13.5px]">
              Sign in with my email
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Open request banner */}
          {openRequest && (
            <Card className="flex flex-wrap items-center gap-4 border-amber-300 bg-amber-50 px-6 py-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-amber-700">
                <Loader2 className="h-5 w-5 animate-spin" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-amber-900">
                  Your linking request is being reviewed
                </p>
                <p className="mt-0.5 text-[12.5px] text-amber-800">
                  Submitted {fmtDate(openRequest.createdAt)} · we'll notify you
                  the moment it's processed.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full border-amber-400 bg-white text-[12.5px] font-bold text-amber-900 hover:bg-amber-100"
                disabled={cancellingId === openRequest._id}
                onClick={() => handleCancel(openRequest._id)}
              >
                {cancellingId === openRequest._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {cancellingId === openRequest._id ? "Cancelling…" : "Withdraw"}
              </Button>
            </Card>
          )}

          {/* Request form */}
          {!openRequest && (
            <Card className="px-6 py-6">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-evergreen">
                Linking request
              </p>
              <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-stone">
                Tell us who the plan is registered to. We'll verify it against
                our records and connect the plan to{" "}
                <strong className="text-ink">{overview.email}</strong>.
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone">
                      Planholder's full name
                    </span>
                    <input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Exactly as written on the plan"
                      className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-stone/60 focus:border-evergreen/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone">
                      Contact number
                    </span>
                    <input
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="09XX XXX XXXX"
                      className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-stone/60 focus:border-evergreen/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone">
                      Email on this account
                    </span>
                    <input
                      value={contactEmail}
                      readOnly
                      className="mt-1.5 h-10 w-full cursor-not-allowed rounded-xl border border-line bg-cream px-3.5 text-[13.5px] text-stone outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone">
                      Nearest branch{" "}
                      <span className="font-normal normal-case text-stone/70">
                        (optional)
                      </span>
                    </span>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-[13.5px] text-ink outline-none transition-colors focus:border-evergreen/50"
                    >
                      <option value="">No preference</option>
                      {activeBranches.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name} — {b.city}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone">
                    Anything we should know?{" "}
                    <span className="font-normal normal-case text-stone/70">
                      (optional)
                    </span>
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="e.g. plan number, the name it was registered under, or the branch you signed up at"
                    className="mt-1.5 w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-stone/60 focus:border-evergreen/50"
                  />
                </label>

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-red-700">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-10 gap-2 rounded-full px-6 text-[13.5px]"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {submitting ? "Sending…" : "Send linking request"}
                  </Button>
                  <span className="text-[11.5px] text-stone">
                    Reviewed during office hours. Bring a valid ID if we ask you
                    to visit a branch.
                  </span>
                </div>
              </form>
            </Card>
          )}
        </>
      )}

      {/* History */}
      {requests.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-evergreen">
            Request history
          </h2>
          <div className="space-y-2.5">
            {requests.map((r) => (
              <Card key={r._id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-ink">
                      Account linking request
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-stone">
                      {fmtDate(r.createdAt)}
                      {r.preferredDate ? ` · preferred ${fmtDay(r.preferredDate)}` : ""}
                    </p>
                  </div>
                  <StatusPill map={REQUEST_PILL} status={r.status} />
                </div>
                {r.staffNotes && (
                  <p className="mt-2 rounded-lg bg-cream px-2.5 py-1.5 text-[11.5px] text-evergreen">
                    <strong>Office note:</strong> {r.staffNotes}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Helper note */}
      {!hasRecords && !overview.isAnonymous && overview.email && (
        <Card className="flex flex-wrap items-center gap-4 px-6 py-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-evergreen/8 text-evergreen">
            <FileHeart className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-stone">
            Prefer to sort this in person? Visit any branch with a valid ID and
            your plan details and our team will link the records on the spot.
          </p>
        </Card>
      )}
    </div>
  );
}
