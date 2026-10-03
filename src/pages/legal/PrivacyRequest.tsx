import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  COMPANY,
  REQUEST_KINDS,
  requestKindLabel,
  validateRequest,
  type RequestDraft,
} from "@/lib/legal";

/**
 * Public data request form.
 *
 * "Delete my data" has to be reachable by someone who has no account and no
 * API key, so this posts straight to the public endpoint rather than through a
 * Convex mutation. The rules it enforces are the same `validateRequest` the
 * server runs, so nothing is accepted here that the office could not act on.
 */
const EMPTY: RequestDraft = {
  kind: "delete",
  name: "",
  email: "",
  contactNumber: "",
  planNumber: "",
  branch: "",
  details: "",
};

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-base text-ink outline-none transition-colors focus:border-evergreen/50";

export default function PrivacyRequest() {
  const [form, setForm] = useState<RequestDraft>(EMPTY);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const set = (patch: Partial<RequestDraft>) => {
    setForm((f) => ({ ...f, ...patch }));
    setIssues((i) => {
      const next = { ...i };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const found = validateRequest(form);
    if (found.length > 0) {
      setIssues(Object.fromEntries(found.map((i) => [i.field, i.message])));
      return;
    }
    setIssues({});
    setStatus("sending");

    try {
      const response = await fetch(`${import.meta.env.VITE_CONVEX_URL}/privacy-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json()) as {
        ok: boolean;
        error?: string;
        reference?: string;
      };
      if (!response.ok || !body.ok) {
        setServerError(
          body.error ??
            "We could not send that just now. Please call the office instead."
        );
        setStatus("idle");
        return;
      }
      setReference(body.reference ?? null);
      setStatus("sent");
    } catch {
      setServerError(
        "We could not reach the office just now. Please call the hotline, or try again later."
      );
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink antialiased">
      <a
        href="#request-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-evergreen focus:px-5 focus:py-2.5 focus:text-[14px] focus:font-bold focus:text-white"
      >
        Skip to the form
      </a>

      <header className="border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link
            to="/"
            className="flex items-center gap-3"
            aria-label="Evangelist Funeral Services — home"
          >
            <BrandLogo className="h-9 w-9 rounded-[9px] shadow-sm ring-1 ring-black/10" />
            <span className="hidden leading-tight sm:block">
              <span className="font-brayles block text-[18px] leading-tight text-blue-800">
                Evangelist
              </span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-stone">
                Your data
              </span>
            </span>
          </Link>
          <Link to="/legal/privacy" className="text-[13.5px] font-bold text-evergreen underline underline-offset-2">
            Read the privacy policy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-gold">
          {COMPANY.legalName}
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-evergreen lg:text-[40px]">
          Ask us what we hold, or ask us to delete it
        </h1>
        <p className="mt-4 text-[15.5px] leading-relaxed text-stone">
          You do not need an account, and you do not have to give a reason. Fill
          in this form and it goes to the office. We answer within fifteen days,
          usually sooner. If you would rather speak to a person, call{" "}
          <a
            href={`tel:${COMPANY.hotline.replace(/\s/g, "")}`}
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            {COMPANY.hotline}
          </a>{" "}
          or visit any branch.
        </p>

        {status === "sent" ? (
          <div className="mt-10 rounded-2xl border border-evergreen/25 bg-evergreen/5 p-7">
            <div className="flex items-start gap-3.5">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-evergreen" aria-hidden="true" />
              <div>
                <h2 className="font-display text-[22px] font-semibold text-evergreen">
                  We have your request
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-stone">
                  Your <strong className="text-ink">{requestKindLabel(form.kind)}</strong>{" "}
                  request is logged as{" "}
                  <strong className="text-ink">{reference ?? "received"}</strong>.
                  We will confirm by email at {form.email} within fifteen days.
                  Keep the reference in case you call about it.
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-stone">
                  Before we act, we will check who you are — usually by confirming
                  from the email on the record, or by asking you to visit a branch
                  with a valid ID. We will never ask for your six-digit sign-in
                  code.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link to="/legal/privacy">
                    <Button className="h-11 rounded-full px-6 text-[14px] font-bold">
                      Back to the privacy policy
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="h-11 rounded-full border-evergreen/25 px-6 text-[14px] font-bold text-evergreen hover:bg-evergreen hover:text-white"
                    onClick={() => {
                      setForm(EMPTY);
                      setReference(null);
                      setStatus("idle");
                    }}
                  >
                    Make another request
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form
            id="request-form"
            onSubmit={handleSubmit}
            className="mt-10 space-y-6 rounded-2xl border border-line bg-white p-6 sm:p-8"
          >
            <fieldset>
              <legend className="text-[12px] font-bold uppercase tracking-[0.16em] text-evergreen">
                What would you like us to do?
              </legend>
              <div className="mt-3 space-y-2.5">
                {REQUEST_KINDS.map((kind) => (
                  <label
                    key={kind.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      form.kind === kind.value
                        ? "border-evergreen bg-evergreen/5"
                        : "border-line hover:bg-cream"
                    }`}
                  >
                    <input
                      type="radio"
                      name="request-kind"
                      value={kind.value}
                      checked={form.kind === kind.value}
                      onChange={() => set({ kind: kind.value })}
                      className="mt-1 h-4 w-4 accent-[#1b4332]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-ink">
                        {kind.label}
                      </span>
                      <span className="mt-0.5 block text-[13.5px] leading-relaxed text-stone">
                        {kind.blurb}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {issues.kind && (
                <p role="alert" className="mt-2 text-[13px] font-semibold text-red-700">
                  {issues.kind}
                </p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="req-name"
                  className="block text-[12px] font-bold uppercase tracking-wider text-stone"
                >
                  Full name *
                </label>
                <input
                  id="req-name"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className={`mt-1.5 ${inputClass}`}
                  autoComplete="name"
                  aria-invalid={!!issues.name}
                  aria-describedby={issues.name ? "req-name-error" : undefined}
                />
                {issues.name && (
                  <p id="req-name-error" role="alert" className="mt-1.5 text-[12.5px] font-semibold text-red-700">
                    {issues.name}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="req-email"
                  className="block text-[12px] font-bold uppercase tracking-wider text-stone"
                >
                  Email *
                </label>
                <input
                  id="req-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  className={`mt-1.5 ${inputClass}`}
                  autoComplete="email"
                  aria-invalid={!!issues.email}
                  aria-describedby={issues.email ? "req-email-error" : undefined}
                />
                {issues.email && (
                  <p id="req-email-error" role="alert" className="mt-1.5 text-[12.5px] font-semibold text-red-700">
                    {issues.email}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="req-contact"
                  className="block text-[12px] font-bold uppercase tracking-wider text-stone"
                >
                  Contact number on the record
                </label>
                <input
                  id="req-contact"
                  value={form.contactNumber}
                  onChange={(e) => set({ contactNumber: e.target.value })}
                  className={`mt-1.5 ${inputClass}`}
                  placeholder="09XX XXX XXXX"
                  autoComplete="tel"
                  aria-invalid={!!issues.contactNumber}
                  aria-describedby={issues.contactNumber ? "req-contact-error" : undefined}
                />
                {issues.contactNumber && (
                  <p id="req-contact-error" role="alert" className="mt-1.5 text-[12.5px] font-semibold text-red-700">
                    {issues.contactNumber}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="req-plan"
                  className="block text-[12px] font-bold uppercase tracking-wider text-stone"
                >
                  Plan number
                </label>
                <input
                  id="req-plan"
                  value={form.planNumber}
                  onChange={(e) => set({ planNumber: e.target.value })}
                  className={`mt-1.5 ${inputClass}`}
                  placeholder="If you know it"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="req-branch"
                  className="block text-[12px] font-bold uppercase tracking-wider text-stone"
                >
                  Branch that holds your record
                </label>
                <input
                  id="req-branch"
                  value={form.branch}
                  onChange={(e) => set({ branch: e.target.value })}
                  className={`mt-1.5 ${inputClass}`}
                  placeholder="For example Malaybalay — or leave blank"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="req-details"
                  className="block text-[12px] font-bold uppercase tracking-wider text-stone"
                >
                  Anything else we should know
                </label>
                <textarea
                  id="req-details"
                  rows={4}
                  value={form.details}
                  onChange={(e) => set({ details: e.target.value })}
                  className="mt-1.5 w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-base text-ink outline-none transition-colors focus:border-evergreen/50"
                />
                {issues.details && (
                  <p role="alert" className="mt-1.5 text-[12.5px] font-semibold text-red-700">
                    {issues.details}
                  </p>
                )}
              </div>
            </div>

            {serverError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
                {serverError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <Button
                type="submit"
                disabled={status === "sending"}
                className="h-12 gap-2 rounded-full px-7 text-[14.5px] font-bold"
              >
                {status === "sending" && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {status === "sending" ? "Sending…" : "Send my request"}
              </Button>
              <p className="text-[13px] leading-relaxed text-stone">
                We use what you type here only to answer the request. Read the{" "}
                <Link
                  to="/legal/privacy"
                  className="font-semibold text-evergreen underline underline-offset-2"
                >
                  privacy policy
                </Link>
                .
              </p>
            </div>

            <p className="text-[12.5px] text-stone">
              You are not signed in on this page, so nothing is stored in this
              browser to identify you — only what you choose to type above.
            </p>
          </form>
        )}
      </main>

      <footer className="border-t border-line bg-pine py-8 text-white/75">
        <div className="mx-auto max-w-[1180px] px-4 text-[12.5px] sm:px-6 lg:px-10">
          <p>
            © 2026 {COMPANY.legalName} · {COMPANY.mainOffice.lines[1]} ·{" "}
            {COMPANY.hotline}
          </p>
        </div>
      </footer>
    </div>
  );
}