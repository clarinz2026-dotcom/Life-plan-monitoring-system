/**
 * Top-of-app progress bar.
 *
 * It stays out of the way when nothing is happening and slides in whenever the
 * app is actually working: a route change (the new page chunk is still being
 * fetched) or a Convex request / mutation in flight. Driven by two signals so a
 * slow query on an already-loaded route is still acknowledged.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router";
import { useConvexConnectionState } from "convex/react";

/** Held on screen at least this long, so the bar reads as motion rather than as
 *  a one-frame flash on a fast link. */
const MIN_VISIBLE_MS = 320;
/** A route change only holds the bar this long on its own; a real request or
 *  mutation takes over from there. */
const ROUTE_GRACE_MS = 1200;

export function RouteProgress() {
  const { pathname } = useLocation();
  const { hasInflightRequests, inflightMutations, isWebSocketConnected } =
    useConvexConnectionState() ?? {};

  // True between a route change and the grace window closing.
  const [routePending, setRoutePending] = useState(false);
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setRoutePending(true);
    const release = window.setTimeout(() => setRoutePending(false), ROUTE_GRACE_MS);
    return () => window.clearTimeout(release);
  }, [pathname]);

  const busy =
    routePending ||
    hasInflightRequests === true ||
    (inflightMutations ?? 0) > 0;
  // A dropped socket with nothing in flight is a real stall worth showing.
  const stalled = isWebSocketConnected === false && !busy;

  // Show at once; hide only after the bar has been up long enough to be read.
  useEffect(() => {
    if (busy || stalled) {
      if (!visible) {
        shownAt.current = Date.now();
        setVisible(true);
      }
      return;
    }
    if (!visible) return;
    const elapsed = Date.now() - shownAt.current;
    if (elapsed >= MIN_VISIBLE_MS) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), MIN_VISIBLE_MS - elapsed);
    return () => window.clearTimeout(timer);
  }, [busy, stalled, visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="route-progress"
          role="progressbar"
          aria-label={stalled ? "Reconnecting" : "Loading"}
          aria-busy={busy}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed left-0 right-0 top-0 z-[100000] h-0.5 overflow-hidden"
        >
          {stalled ? (
            // Reconnecting: a slow, honest pulse instead of a false progress.
            <motion.div
              className="h-full w-full bg-gold/70"
              animate={{ opacity: [0.25, 0.8, 0.25] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            <motion.div
              className="h-full bg-gradient-to-r from-gold via-evergreen to-gold"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: 0.9,
                ease: [0.25, 0.1, 0.25, 1],
                repeat: Infinity,
                repeatType: "reverse",
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
