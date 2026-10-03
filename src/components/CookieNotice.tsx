import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COOKIE_CONSENT_KEY, STORAGE_INVENTORY } from "@/lib/legal";

/**
 * Cookie / storage notice.
 *
 * Deliberately NOT a tracking consent dialog with a fake "accept or reject"
 * pair: this site stores nothing beyond what sign-in needs, so there is nothing
 * to decline. Offering two buttons that do the same thing would be a dark
 * pattern of its own. Instead the notice states what is stored, records that
 * it was seen, and offers a way to clear that record.
 *
 * Any page can reopen it by dispatching `evangelist:open-cookie-notice`.
 */
export const OPEN_COOKIE_NOTICE_EVENT = "evangelist:open-cookie-notice";

type Consent = { decidedAt: string };

function readDecision(): Consent | null {
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    return typeof parsed?.decidedAt === "string" ? parsed : null;
  } catch {
    // Storage can be blocked (private windows, framed contexts). Never treat a
    // read failure as "already agreed" — and never let it throw.
    return null;
  }
}

export default function CookieNotice() {
  // Read once, lazily: the notice must not flash for a returning visitor, and
  // it must not setState from inside an effect (which cascades a render).
  const [decision, setDecision] = useState<Consent | null>(() =>
    typeof window === "undefined" ? null : readDecision()
  );
  const [open, setOpen] = useState(
    () => typeof window !== "undefined" && readDecision() === null
  );
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    function reopen() {
      setDecision(readDecision());
      setExpanded(false);
      setOpen(true);
    }
    window.addEventListener(OPEN_COOKIE_NOTICE_EVENT, reopen);
    return () =>
      window.removeEventListener(OPEN_COOKIE_NOTICE_EVENT, reopen);
  }, []);

  const acknowledge = useCallback(() => {
    const next: Consent = { decidedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — the notice simply returns next visit */
    }
    setDecision(next);
    setOpen(false);
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(COOKIE_CONSENT_KEY);
    } catch {
      /* nothing to clear */
    }
    setDecision(null);
    setExpanded(false);
    setOpen(true);
  }, []);

  if (!open) {
    // Dismissed: leave only a way to look again, so the notice is never a
    // one-way door.
    return decision ? (
      <div className="fixed bottom-3 right-3 z-[99980]">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event(OPEN_COOKIE_NOTICE_EVENT))
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/95 px-3.5 py-2 text-[12px] font-semibold text-ink/80 shadow-md backdrop-blur transition-colors hover:bg-cream hover:text-evergreen"
        >
          <Cookie className="h-3.5 w-3.5" aria-hidden="true" />
          Cookie notice
        </button>
      </div>
    ) : null;
  }

  return (
    <aside
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-[99980] border-t border-line bg-white/97 px-4 py-4 shadow-[0_-8px_30px_-20px_rgba(16,41,29,0.5)] backdrop-blur sm:px-6"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13.5px] font-bold text-evergreen">
              <Cookie className="h-4 w-4" aria-hidden="true" />
              Cookies on this site
            </p>
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink/80">
              We use {STORAGE_INVENTORY.length} cookies and stored values, all of
              them needed to keep you signed in or the page working. No
              advertising, no analytics, no third-party trackers &mdash; so
              there is nothing to decline.{" "}
              <Link
                to="/legal/cookies"
                className="font-semibold text-evergreen underline underline-offset-2"
              >
                Read the cookie policy
              </Link>
              .
            </p>

            {expanded && (
              <ul className="mt-3 space-y-1.5 rounded-xl bg-cream px-3.5 py-3 text-[12.5px] leading-relaxed text-ink/85">
                {STORAGE_INVENTORY.map((item) => (
                  <li key={item.name}>
                    <span className="font-semibold text-ink">{item.name}</span>{" "}
                    &mdash; {item.purpose}{" "}
                    <span className="text-stone">({item.duration})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-evergreen/25 px-4 text-[13px] font-bold text-evergreen hover:bg-evergreen hover:text-white"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide the list" : "Show the list"}
            </Button>
            {decision && (
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-full px-4 text-[13px] font-bold text-ink/70 hover:text-evergreen"
                onClick={clear}
              >
                Clear my choice
              </Button>
            )}
            <Button
              type="button"
              className="h-10 rounded-full px-5 text-[13px] font-bold"
              onClick={acknowledge}
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}