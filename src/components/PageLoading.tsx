/**
 * Loading state for a page or a panel that is waiting on its first query.
 *
 * Used where a page used to render bare "Loading…" text, so every wait in the
 * app looks the same: the brand mark breathing, a shimmering rule, and a label.
 */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

export function PageLoading({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex min-h-[60vh] w-full flex-col items-center justify-center gap-5 px-6 text-center",
        className
      )}
    >
      <div className="relative">
        {/* Soft halo that breathes with the mark. */}
        <motion.span
          aria-hidden="true"
          className="absolute -inset-3 -z-10 rounded-[18px] bg-evergreen/10 blur-lg"
          animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.96, 1.04, 0.96] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          animate={{ opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <BrandLogo className="h-11 w-11 rounded-[11px] ring-1 ring-evergreen/10" />
        </motion.div>
      </div>

      <div className="flex w-40 flex-col items-center gap-2.5">
        {/* Shimmer rule, so the wait has motion even before the label lands. */}
        <span className="relative block h-1 w-full overflow-hidden rounded-full bg-line">
          <motion.span
            className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent"
            initial={{ x: "-120%" }}
            animate={{ x: "420%" }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone">
          {label}
        </span>
      </div>
    </div>
  );
}

/** Compact variant for a table cell or a card body. */
export function InlineLoading({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex items-center justify-center gap-2.5 py-10", className)}
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-gold/25 animate-ping" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-gold" />
      </span>
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </div>
  );
}
