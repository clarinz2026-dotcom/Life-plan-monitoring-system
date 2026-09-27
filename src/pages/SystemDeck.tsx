import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { DECK_FILE_NAME, DECK_OUTLINE, downloadSystemDeck, type ShotMap } from "@/lib/systemDeck";
import {
  SHOT_SLOTS,
  captureRoute,
  fileToShot,
  loadBundledShots,
  type ShotSlot,
} from "@/lib/captureShots";
import {
  Building2,
  Camera,
  Check,
  Download,
  ImageIcon,
  Loader2,
  Link2,
  Presentation,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  Users2,
  X,
} from "lucide-react";

/**
 * Presentation hub for the proposal deck.
 *
 * The two flows are laid out on screen exactly as they are separated in the
 * PowerPoint — client side first, staff side beside it — with the shared
 * account-linking handshake underneath.
 *
 * Screenshots are captured here, in the browser: a hidden same-origin iframe
 * loads each route with the current session, snapdom rasterises it, and the
 * resulting image is embedded straight into the .pptx. Any slot that is left
 * empty simply keeps its diagram, so the deck is never incomplete.
 *
 * Real screenshots are pre-loaded from `public/shots/` when they exist, so the
 * deck already carries the live screens without anyone having to press capture.
 */

const CLIENT_STEPS = [
  { label: "Create an account", sub: "On the website, with an email address" },
  { label: "Request the link", sub: "Name, contact number, email, preferred branch" },
  { label: "The office verifies", sub: "Staff match the request to a client file" },
  { label: "Records unlock", sub: "Their plans and payment history appear" },
  { label: "Their own statement", sub: "Payments summary, SOA and receipts — any hour" },
];

const STAFF_STEPS = [
  { label: "Sign in", sub: "Role and branch scope applied automatically" },
  { label: "Client file", sub: "Created new, or bulk-imported from the old ledgers" },
  { label: "Plan & contract", sub: "Type, value, monthly installment, beneficiaries" },
  { label: "Record payment", sub: "Single entry, or a whole batch upload" },
  { label: "Receipt & ledger", sub: "Auto-numbered receipt; balance and status updated" },
];

const LINK_LANES = [
  { lane: "Client", icon: Users2, steps: ["Creates an account", "Files a linking request", "Sees the outcome"] },
  { lane: "System", icon: ShieldCheck, steps: ["Alerts every staff account", "Holds one open request", "Notifies the outcome"] },
  { lane: "Staff", icon: Building2, steps: ["Reviews the request", "Matches a client file", "Approves or declines"] },
];

const ROLE_NOTE: Record<ShotSlot["asRole"], string> = {
  public: "No sign-in needed",
  staff: "Best captured signed in as staff",
  client: "Best captured signed in as a client",
};

function FlowColumn({
  kicker,
  title,
  route,
  steps,
  accent,
}: {
  kicker: string;
  title: string;
  route: string;
  steps: { label: string; sub: string }[];
  accent: "light" | "dark";
}) {
  const dark = accent === "dark";
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 sm:p-7 ${
        dark ? "border-evergreen/20 bg-evergreen text-white" : "border-line bg-paper text-ink"
      }`}
    >
      <span
        className={`font-figures text-[10px] font-bold tracking-[0.16em] uppercase ${
          dark ? "text-gold-soft" : "text-gold"
        }`}
      >
        {kicker}
      </span>
      <h3
        className={`font-display mt-1.5 text-[21px] leading-snug font-semibold ${
          dark ? "text-white" : "text-evergreen"
        }`}
      >
        {title}
      </h3>
      <code
        className={`font-figures mt-1 inline-block w-fit rounded-md px-2 py-0.5 text-[11px] ${
          dark ? "bg-white/10 text-gold-soft" : "bg-evergreen/6 text-stone"
        }`}
      >
        {route}
      </code>

      <ol className="mt-5 space-y-3">
        {steps.map((step, i) => (
          <li key={step.label} className="flex gap-3">
            <span
              className={`font-figures mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                dark ? "bg-gold text-evergreen" : "bg-evergreen text-white"
              }`}
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-[13.5px] font-semibold ${dark ? "text-white" : "text-ink"}`}>
                {step.label}
              </span>
              <span className={`block text-[12px] leading-snug ${dark ? "text-sage" : "text-stone"}`}>
                {step.sub}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DownloadButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={busy} className="h-12 gap-2 px-6 text-[15px]">
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
      {busy ? "Building the deck…" : "Download PowerPoint (.pptx)"}
    </Button>
  );
}

export default function SystemDeck() {
  const [shots, setShots] = useState<ShotMap>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [capturingAll, setCapturingAll] = useState(false);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const [autoLoaded, setAutoLoaded] = useState(0);

  // Screenshots already saved in `public/shots/` are picked up on mount, so the
  // deck is ready to download without capturing anything.
  useEffect(() => {
    let cancelled = false;
    void loadBundledShots().then((bundled) => {
      if (cancelled) return;
      const count = Object.keys(bundled).length;
      if (!count) return;
      setShots((prev) => ({ ...bundled, ...prev }));
      setAutoLoaded(count);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const capturedCount = SHOT_SLOTS.filter((s) => shots[s.id]).length;

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadSystemDeck(shots);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The presentation could not be built. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const runCapture = async (slot: ShotSlot) => {
    setActiveSlot(slot.id);
    setSlotErrors((prev) => ({ ...prev, [slot.id]: "" }));
    try {
      const shot = await captureRoute(slot);
      setShots((prev) => ({ ...prev, [slot.id]: shot }));
    } catch (e) {
      setSlotErrors((prev) => ({
        ...prev,
        [slot.id]: e instanceof Error ? e.message : "Capture failed.",
      }));
    } finally {
      setActiveSlot(null);
    }
  };

  const captureAll = async () => {
    setCapturingAll(true);
    for (const slot of SHOT_SLOTS) {
      await runCapture(slot);
    }
    setCapturingAll(false);
  };

  const handleUpload = async (slot: ShotSlot, file: File) => {
    setSlotErrors((prev) => ({ ...prev, [slot.id]: "" }));
    try {
      const shot = await fileToShot(file);
      setShots((prev) => ({ ...prev, [slot.id]: shot }));
    } catch (e) {
      setSlotErrors((prev) => ({
        ...prev,
        [slot.id]: e instanceof Error ? e.message : "That image could not be used.",
      }));
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink antialiased">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-3" aria-label="Evangelist home">
            <BrandLogo className="h-9 w-9 rounded-[9px] shadow-sm ring-1 ring-black/10" />
            <span className="leading-tight">
              <span className="font-brayles block text-[16px] text-evergreen">
                Evangelist
              </span>
              <span className="block text-[10px] font-medium tracking-[0.16em] text-stone uppercase">
                Presentation deck
              </span>
            </span>
          </a>
          <a
            href="/dashboard"
            className="rounded-full border border-evergreen/25 px-4 py-2 text-[12.5px] font-bold text-evergreen transition-colors hover:bg-evergreen hover:text-white"
          >
            Staff portal
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-12 pb-20 sm:px-6">
        {/* ── Hero ── */}
        <section className="max-w-3xl">
          <span className="font-figures inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/8 px-3 py-1.5 text-[11px] font-bold tracking-[0.14em] text-gold uppercase">
            <Presentation className="h-3.5 w-3.5" />
            System flow
          </span>
          <h1 className="font-display mt-5 text-[34px] leading-[1.15] font-semibold text-evergreen sm:text-[42px]">
            Records, Payments &amp; Client Portal
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-stone">
            An eleven-slide presentation covering how the system works from both sides — the branch
            staff who run the records, and the families who can finally see their own plan. Capture
            the real screens below and they are placed into the slides automatically.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <DownloadButton busy={busy} onClick={handleDownload} />
            <span className="font-figures text-[12.5px] text-stone">
              11 slides · 16:9 · {DECK_FILE_NAME}
            </span>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              {error}
            </p>
          )}
        </section>

        {/* ── Screenshots ── */}
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <span className="font-figures text-[10.5px] font-bold tracking-[0.16em] text-gold uppercase">
                Screenshots
              </span>
              <h2 className="font-display mt-1.5 text-[26px] font-semibold text-evergreen">
                Put the real screens in the deck
              </h2>
            </div>
            <span className="font-figures text-[12.5px] text-stone">
              {capturedCount} of {SHOT_SLOTS.length} ready
              {autoLoaded > 0 && ` · ${autoLoaded} loaded from saved captures`}
            </span>
          </div>

          <p className="mt-5 max-w-3xl text-[13.5px] leading-relaxed text-stone">
            Capturing happens in your own browser: each page is loaded into a hidden frame with your
            current sign-in and photographed as it actually renders. Nothing is uploaded anywhere,
            and the images go straight into the PowerPoint you download. Slots left empty keep their
            flow diagram instead.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              onClick={captureAll}
              disabled={capturingAll || activeSlot !== null}
              className="h-11 gap-2 px-5 text-[14px]"
            >
              {capturingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {capturingAll ? "Capturing…" : "Capture all screenshots"}
            </Button>
            {capturedCount > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setShots({});
                  setSlotErrors({});
                }}
                disabled={capturingAll}
                className="h-11 gap-2 px-4 text-[14px]"
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </Button>
            )}
            <span className="text-[12px] text-stone">
              Sign in with the right account first — the client portal screens need a client login.
            </span>
          </div>

          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {SHOT_SLOTS.map((slot) => {
              const shot = shots[slot.id];
              const isActive = activeSlot === slot.id;
              const err = slotErrors[slot.id];
              return (
                <li key={slot.id} className="flex gap-4 rounded-2xl border border-line bg-paper p-4">
                  <div className="relative h-[86px] w-[138px] shrink-0 overflow-hidden rounded-lg border border-line bg-cream">
                    {shot ? (
                      <img
                        src={shot.dataUrl}
                        alt={slot.label}
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-stone">
                        {isActive ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <ImageIcon className="h-5 w-5" />
                        )}
                        <span className="text-[10px] tracking-wide uppercase">
                          {isActive ? "Capturing" : "Empty"}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13.5px] font-semibold text-ink">{slot.label}</span>
                      {shot ? (
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-evergreen text-white">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      ) : err ? (
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                          <X className="h-2.5 w-2.5" />
                        </span>
                      ) : null}
                    </div>
                    <span className="font-figures mt-0.5 text-[11px] text-stone">
                      {slot.route} · {slot.usedOn}
                    </span>
                    <span className="mt-0.5 text-[11px] text-stone">{ROLE_NOTE[slot.asRole]}</span>

                    {err && <span className="mt-1 text-[11px] text-red-700">{err}</span>}

                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runCapture(slot)}
                        disabled={isActive || capturingAll}
                        className="h-7 gap-1.5 px-2.5 text-[12px]"
                      >
                        {isActive ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        {shot ? "Retake" : "Capture"}
                      </Button>
                      <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-cream">
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleUpload(slot, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {shot && (
                        <button
                          type="button"
                          onClick={() =>
                            setShots((prev) => {
                              const next = { ...prev };
                              delete next[slot.id];
                              return next;
                            })
                          }
                          className="text-[12px] text-stone transition-colors hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── The two flows, kept apart ── */}
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <span className="font-figures text-[10.5px] font-bold tracking-[0.16em] text-gold uppercase">
                The two entry points
              </span>
              <h2 className="font-display mt-1.5 text-[26px] font-semibold text-evergreen">
                One system, two completely different journeys
              </h2>
            </div>
            <p className="max-w-md text-[13px] leading-relaxed text-stone">
              Both sides end at the same records — one from the office counter, one from a phone.
            </p>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <FlowColumn
              kicker="Client side"
              title="From a family's phone to their own statement"
              route="/portal"
              steps={CLIENT_STEPS}
              accent="light"
            />
            <FlowColumn
              kicker="Staff side"
              title="From a walk-in to a receipted, monitored record"
              route="/dashboard"
              steps={STAFF_STEPS}
              accent="dark"
            />
          </div>
        </section>

        {/* ── Where the two meet ── */}
        <section className="mt-16">
          <div className="border-b border-line pb-4">
            <span className="font-figures text-[10.5px] font-bold tracking-[0.16em] text-gold uppercase">
              Where the two sides meet
            </span>
            <h2 className="font-display mt-1.5 flex items-center gap-2.5 text-[26px] font-semibold text-evergreen">
              <Link2 className="h-5 w-5 text-gold" />
              Account linking — the family asks, the office decides
            </h2>
          </div>

          <div className="mt-7 overflow-hidden rounded-2xl border border-line bg-paper">
            {LINK_LANES.map(({ lane, icon: Icon, steps }, laneIndex) => (
              <div
                key={lane}
                className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:px-7 ${
                  laneIndex > 0 ? "border-t border-line" : ""
                }`}
              >
                <div className="flex w-full shrink-0 items-center gap-2.5 sm:w-40">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-evergreen text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-figures text-[11.5px] font-bold tracking-[0.14em] text-evergreen uppercase">
                    {lane}
                  </span>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-3">
                  {steps.map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className="rounded-lg border border-line bg-cream px-3 py-2 text-[12.5px] font-medium text-ink">
                        {step}
                      </span>
                      {i < steps.length - 1 && <span className="text-gold">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t border-line bg-evergreen px-5 py-4 sm:px-7">
              <p className="text-[12.5px] leading-relaxed text-sage">
                <span className="font-semibold text-white">Approved</span> — the family's plan is
                unlocked in the portal.{"  "}
                <span className="font-semibold text-white">Declined</span> — they are asked to visit
                a branch with a valid ID. One email address links to one client file only.
              </p>
            </div>
          </div>
        </section>

        {/* ── What is inside the file ── */}
        <section className="mt-16">
          <div className="border-b border-line pb-4">
            <span className="font-figures text-[10.5px] font-bold tracking-[0.16em] text-gold uppercase">
              Inside the deck
            </span>
            <h2 className="font-display mt-1.5 text-[26px] font-semibold text-evergreen">
              Eleven slides
            </h2>
          </div>

          <ol className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {DECK_OUTLINE.map((slide, i) => (
              <li
                key={slide.title}
                className="flex items-center gap-3.5 rounded-xl border border-line bg-paper px-4 py-3"
              >
                <span className="font-figures w-6 shrink-0 text-[12px] font-bold text-gold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">{slide.title}</span>
                <span className="shrink-0 rounded-full border border-evergreen/15 bg-evergreen/6 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-evergreen uppercase">
                  {slide.track}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Footer CTA ── */}
        <section className="mt-16 rounded-2xl border border-line bg-paper px-6 py-8 text-center sm:px-10">
          <h2 className="font-display text-[24px] font-semibold text-evergreen">
            Ready to send or present
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[13.5px] leading-relaxed text-stone">
            {capturedCount > 0
              ? `${capturedCount} real screenshot${capturedCount === 1 ? "" : "s"} will be embedded. The file opens in PowerPoint, Keynote, Google Slides and LibreOffice.`
              : "Captured screenshots are embedded into the slides. The file opens in PowerPoint, Keynote, Google Slides and LibreOffice."}
          </p>
          <div className="mt-6 flex justify-center">
            <DownloadButton busy={busy} onClick={handleDownload} />
          </div>
        </section>

        <p className="mt-10 text-center text-[11.5px] text-stone">
          Evangelist Funeral Services OPC · To Care and To Serve · Service Today. Peace Forever.
        </p>
      </main>
    </div>
  );
}
