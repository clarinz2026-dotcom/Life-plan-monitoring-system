import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Check, Loader2, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router";
import {
  Card,
  PortalShell,
  REQUEST_PILL,
  SERVICES,
  SERVICE_BY_KEY,
  StatusPill,
  fmtDate,
  fmtDay,
} from "./shared";
import { SOAButton } from "./SOAButton";

export default function Services() {
  const [searchParams] = useSearchParams();
  const preset = searchParams.get("type");
  const initialType =
    preset && SERVICE_BY_KEY[preset] ? preset : (SERVICES[0]?.key ?? "");

  const [serviceType, setServiceType] = useState(initialType);
  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const branches = useQuery(api.branches.list);
  const myRequests = useQuery(api.portal.myRequests);
  const overview = useQuery(api.portal.myOverview);
  const submit = useMutation(api.portal.submitRequest);
  const cancel = useMutation(api.portal.cancelMyRequest);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Prefill contact details from matched records once they load
  useEffect(() => {
    const first = overview?.records?.[0];
    if (first) {
      const c = first.client;
      if (!contactName) setContactName(`${c.firstName} ${c.lastName}`);
      if (!contactNumber) setContactNumber(c.contactNumber);
    }
    // Prefill email from the signed-in auth account
    if (overview?.email && !contactEmail) {
      setContactEmail(overview.email);
    }
  }, [overview, contactName, contactNumber, contactEmail]);

  const activeBranches = (branches ?? []).filter((b) => b.isActive !== false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!contactName.trim() || !contactNumber.trim()) {
      setError("Please provide your name and a contact number.");
      return;
    }
    setSubmitting(true);
    try {
      const preferred =
        preferredDate.trim() && !Number.isNaN(new Date(preferredDate).getTime())
          ? new Date(preferredDate).getTime()
          : undefined;
      await submit({
        serviceType,
        branchId: (branchId || undefined) as Id<"branches"> | undefined,
        contactName: contactName.trim(),
        contactNumber: contactNumber.trim(),
        contactEmail: contactEmail.trim() || undefined,
        preferredDate: preferred,
        message: message.trim() || undefined,
      });
      toast.success("Request received", {
        description:
          "Our team will review it during office hours and reach you by phone or email.",
      });
      setMessage("");
      setPreferredDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
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
      toast.error(err instanceof Error ? err.message : "Could not cancel request.");
    } finally {
      setCancellingId(null);
    }
  };

  const selected = SERVICE_BY_KEY[serviceType];

  return (
    <div className="space-y-10">
      <PortalShell
        title="Book a Service"
        subtitle="Everything Evangelist offers — chapel bookings, cremations, eBurol access, plans, caskets, and support. Send us a request and our team will confirm with you."
      />

      {/* ── Catalog picker ── */}
      <section>
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-stone">
          1 · Choose a service
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => {
            const active = serviceType === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setServiceType(s.key)}
                aria-pressed={active}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? "border-evergreen bg-evergreen text-white shadow-md"
                    : "border-line bg-white hover:border-evergreen/40 hover:shadow-sm"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    active ? "bg-white/15 text-gold-soft" : "bg-evergreen/8 text-evergreen"
                  }`}
                >
                  <s.icon className="h-5 w-5" />
                </span>
                <span>
                  <span
                    className={`block text-[13.5px] font-bold leading-snug ${
                      active ? "text-white" : "text-ink"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span
                    className={`mt-1 block text-[11.5px] leading-relaxed ${
                      active ? "text-white/75" : "text-stone"
                    }`}
                  >
                    {s.desc}
                  </span>
                </span>
                {active && (
                  <span className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-evergreen">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Request form ── */}
      <section className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card className="p-6">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-stone">
            2 · Tell us how to reach you
          </h2>
          <p className="mt-3 flex items-start gap-3 rounded-xl bg-evergreen/6 px-4 py-3 text-[13px] text-evergreen">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-evergreen text-white">
              {selected?.icon ? <selected.icon className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </span>
            <span>
              <strong>{selected?.label ?? "Your request"}</strong> — someone from our
              office will contact you to confirm details and next steps.
            </span>
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-bold text-ink">Full name *</span>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[14px] outline-none transition-colors focus:border-evergreen"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-bold text-ink">Mobile number *</span>
                <input
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. 0917 000 0000"
                  inputMode="tel"
                  className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[14px] outline-none transition-colors focus:border-evergreen"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[12px] font-bold text-ink">Email address (Gmail)</span>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. example@gmail.com"
                inputMode="email"
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[14px] outline-none transition-colors focus:border-evergreen"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-bold text-ink">Preferred branch</span>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-[14px] outline-none transition-colors focus:border-evergreen"
                >
                  <option value="">No preference — office will assign</option>
                  {activeBranches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} — {b.city}, {b.province}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[12px] font-bold text-ink">Preferred date</span>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[14px] outline-none transition-colors focus:border-evergreen"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[12px] font-bold text-ink">
                Notes for our team
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={
                  serviceType === "chapel_booking"
                    ? "e.g. Wake of 3 nights for a planholder at Evangelist Chapel, with eBurol room…"
                    : "Tell us anything that will help us serve you better."
                }
                className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[14px] outline-none transition-colors focus:border-evergreen"
              />
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full gap-2 rounded-full text-[15px] font-bold sm:w-auto sm:px-8"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Submit request
                </>
              )}
            </Button>
            <p className="text-[11.5px] leading-relaxed text-stone/80">
              For same-day needs, call our 24/7 hotline at (02) 8-700-0000 instead —
              chapel staff are available around the clock.
            </p>
          </form>
        </Card>

        {/* ── My requests ── */}
        <section>
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-stone">
            3 · My requests
          </h2>
          {myRequests === undefined ? (
            <Card className="grid min-h-[180px] place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-evergreen" />
            </Card>
          ) : myRequests.length === 0 ? (
            <Card className="px-5 py-10 text-center">
              <p className="text-[13.5px] font-bold text-ink">No requests yet</p>
              <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-stone">
                Choose a service and submit the form — it will appear here so you
                can follow its progress.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {myRequests.map((r) => {
                const meta = SERVICE_BY_KEY[r.serviceType];
                const cancellable = r.status === "submitted" || r.status === "under_review";
                return (
                  <Card key={r._id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-evergreen/8 text-evergreen">
                        {meta?.icon ? <meta.icon className="h-5 w-5" /> : <Send className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[14px] font-bold text-ink">
                            {meta?.label ?? r.serviceType}
                          </p>
                          <StatusPill map={REQUEST_PILL} status={r.status} />
                        </div>
                        <p className="mt-1 text-[11.5px] text-stone">
                          Submitted {fmtDate(r.createdAt)}
                          {r.branch ? ` · ${r.branch.name}, ${r.branch.city}` : ""}
                          {r.preferredDate ? ` · preferred ${fmtDay(r.preferredDate)}` : ""}
                        </p>
                        {r.message && (
                          <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-[12px] leading-relaxed text-stone">
                            {r.message}
                          </p>
                        )}
                        {r.staffNotes && (
                          <p className="mt-1.5 rounded-lg bg-evergreen/6 px-3 py-2 text-[12px] leading-relaxed text-evergreen">
                            <strong>Office note:</strong> {r.staffNotes}
                          </p>
                        )}
                      </div>
                    </div>
                    {r.serviceType === "receipt_copy" && (
                      <div className="mt-2.5 rounded-xl bg-evergreen/6 px-3.5 py-2.5">
                        <p className="text-[11.5px] font-semibold text-evergreen">
                          Your statement is available now — view it on screen or
                          download the PDF.
                        </p>
                        <SOAButton
                          records={overview?.records ?? []}
                          label="View / download my SOA"
                          size="sm"
                          className="mt-2"
                        />
                      </div>
                    )}
                    {cancellable && (
                      <button
                        type="button"
                        onClick={() => handleCancel(r._id)}
                        disabled={cancellingId === r._id}
                        className="mt-2.5 ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold text-stone transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        {cancellingId === r._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Cancel request
                      </button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
