/**
 * Asia/Manila time boundaries.
 *
 * Every timestamp in this app is stored as epoch milliseconds (UTC), but the
 * business runs in the Philippines. "Today's collections" and "this month" must
 * therefore be measured from midnight in Manila — not from the server's clock,
 * which is UTC. Before this module, `new Date().setHours(0,0,0,0)` produced a
 * day boundary at 08:00 Manila time, so a payment taken at 9am on the 1st of
 * the month was counted as last month's collection and the cashier's daily
 * reconciliation total disagreed with the dashboard.
 *
 * The Philippines has a single fixed offset (UTC+8, no daylight saving), so the
 * arithmetic below is exact — no timezone database lookup is needed.
 */

export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Civil (wall-clock) date/time components for a timestamp, in Manila. */
export function manilaParts(ts: number = Date.now()): {
  year: number;
  month: number; // 0-indexed
  date: number;
  weekday: number; // 0 = Sunday
  hours: number;
  minutes: number;
} {
  const shifted = new Date(ts + MANILA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

/** Epoch ms of the start of the Manila day that contains `ts`. */
export function manilaDayStart(ts: number = Date.now()): number {
  const { year, month, date } = manilaParts(ts);
  return Date.UTC(year, month, date) - MANILA_OFFSET_MS;
}

/** Epoch ms of the start of the Manila month that contains `ts`. */
export function manilaMonthStart(ts: number = Date.now()): number {
  const { year, month } = manilaParts(ts);
  return Date.UTC(year, month, 1) - MANILA_OFFSET_MS;
}

/** Epoch ms of the start of the following Manila day. */
export const manilaDayEnd = (ts: number = Date.now()) =>
  manilaDayStart(ts) + MS_PER_DAY;

/** Epoch ms of the start of the Manila month `monthOffset` months from now. */
export function manilaMonthStartOffset(
  monthOffset: number,
  ts: number = Date.now()
): number {
  const { year, month } = manilaParts(ts);
  return Date.UTC(year, month + monthOffset, 1) - MANILA_OFFSET_MS;
}

/** Epoch ms of 1 January of the Manila year containing `ts`. */
export function manilaYearStart(ts: number = Date.now()): number {
  const { year } = manilaParts(ts);
  return Date.UTC(year, 0, 1) - MANILA_OFFSET_MS;
}

/** Epoch ms of midnight on day-of-month `day` in the Manila month of `ts`. */
export function manilaDayOfMonth(
  day: number,
  ts: number = Date.now()
): number {
  const { year, month } = manilaParts(ts);
  return Date.UTC(year, month, day) - MANILA_OFFSET_MS;
}

/** Number of days in the Manila month containing `ts`. */
export function manilaDaysInMonth(ts: number = Date.now()): number {
  const { year, month } = manilaParts(ts);
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** "Sep 2026" label for the Manila month containing `ts`. */
export function manilaMonthLabel(ts: number): string {
  const { year, month } = manilaParts(ts);
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** `YYYY-MM-DD` key in Manila, for grouping collections by day. */
export function manilaDateKey(ts: number): string {
  const { year, month, date } = manilaParts(ts);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

/** Short weekday label ("Mon") for the Manila day containing `ts`. */
export function manilaWeekdayLabel(ts: number): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][manilaParts(ts).weekday];
}

/**
 * Inclusive list of Manila day starts covering the last `days` days, oldest
 * first, ending with today. Used for the 7-day collections chart so the buckets
 * line up with the days the cashiers actually worked.
 */
export function lastManilaDays(days: number, ts: number = Date.now()): number[] {
  const today = manilaDayStart(ts);
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(today - i * MS_PER_DAY);
  return out;
}
