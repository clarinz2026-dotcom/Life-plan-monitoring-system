import { describe, expect, it } from "vitest";
import {
  agingCell,
  installmentDueDate,
  isAdvancedStatus,
  planStatus,
  splitAddressEmail,
} from "../src/components/SOADocument";

const MS_PER_DAY = 86_400_000;

/** Midnight timestamp for a calendar date, matching how due dates are built. */
function ts(y: number, m: number, d: number): number {
  // m is 1-based here for readability in the tests.
  return new Date(y, m - 1, d).getTime();
}

function fmt(t: number): string {
  const d = new Date(t);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

describe("installmentDueDate", () => {
  it("keeps the effectivity day of month (Aug 22 → Sep 22)", () => {
    expect(fmt(installmentDueDate(ts(2026, 8, 22), 1)!)).toBe("09/22/2026");
  });

  it("steps one month per installment", () => {
    expect(fmt(installmentDueDate(ts(2026, 8, 22), 2)!)).toBe("10/22/2026");
    expect(fmt(installmentDueDate(ts(2026, 8, 22), 3)!)).toBe("11/22/2026");
    expect(fmt(installmentDueDate(ts(2026, 8, 22), 5)!)).toBe("01/22/2027");
  });

  it("clamps to the end of short months (Jan 31 → Feb 28)", () => {
    expect(fmt(installmentDueDate(ts(2026, 1, 31), 1)!)).toBe("02/28/2026");
    // The next installment is back on the 31st, not the 28th.
    expect(fmt(installmentDueDate(ts(2026, 1, 31), 2)!)).toBe("03/31/2026");
  });

  it("rolls over year boundaries (Dec 15 → Jan 15)", () => {
    expect(fmt(installmentDueDate(ts(2026, 12, 15), 1)!)).toBe("01/15/2027");
  });

  it("does not snap to the first of the month (regression)", () => {
    const due = installmentDueDate(ts(2026, 8, 22), 1)!;
    expect(new Date(due).getDate()).not.toBe(1);
  });

  it("returns null for installment 0 or bad input", () => {
    expect(installmentDueDate(ts(2026, 8, 22), 0)).toBeNull();
    expect(installmentDueDate(NaN, 1)).toBeNull();
  });
});

describe("agingCell", () => {
  const due = ts(2026, 9, 22);

  it("reads Advanced when paid before the due date", () => {
    expect(agingCell(due, due - 45 * MS_PER_DAY)).toBe("Advanced");
    expect(agingCell(due, due - MS_PER_DAY)).toBe("Advanced");
  });

  it("reads 30 for on-time through 30 days late", () => {
    expect(agingCell(due, due)).toBe("30");
    expect(agingCell(due, due + 1 * MS_PER_DAY)).toBe("30");
    expect(agingCell(due, due + 30 * MS_PER_DAY)).toBe("30");
  });

  it("reads 60 for 31–60 days late", () => {
    expect(agingCell(due, due + 31 * MS_PER_DAY)).toBe("60");
    expect(agingCell(due, due + 60 * MS_PER_DAY)).toBe("60");
  });

  it("reads 90 for 61–90 days late", () => {
    expect(agingCell(due, due + 61 * MS_PER_DAY)).toBe("90");
    expect(agingCell(due, due + 90 * MS_PER_DAY)).toBe("90");
  });

  it("reads Lapsed past 90 days", () => {
    expect(agingCell(due, due + 91 * MS_PER_DAY)).toBe("Lapsed");
    expect(agingCell(due, due + 200 * MS_PER_DAY)).toBe("Lapsed");
  });

  it("shows a dash when there is no due date", () => {
    expect(agingCell(null, Date.now())).toBe("—");
  });
});

describe("isAdvancedStatus", () => {
  const start = ts(2026, 8, 22);

  it("is Advanced when more payments exist than fallen-due installments", () => {
    // Effectivity Aug 22; on Sep 26 only installment 1 (Sep 22) has fallen due.
    const now = ts(2026, 9, 26);
    expect(isAdvancedStatus(start, 4, now)).toBe(true);
  });

  it("is not Advanced while payments match the fallen-due count", () => {
    // By Dec 23, four installments have fallen due (Sep 22…Dec 22).
    const now = ts(2026, 12, 23);
    expect(isAdvancedStatus(start, 4, now)).toBe(false);
  });

  it("is not Advanced with no payments", () => {
    expect(isAdvancedStatus(start, 0, ts(2026, 9, 26))).toBe(false);
  });

  it("reads Advanced when the only payment predates its own due date", () => {
    // Paid Sep 1; the first installment is not due until Sep 22 — that is
    // paying ahead by definition, even though nothing has fallen due yet.
    const now = ts(2026, 9, 1);
    expect(isAdvancedStatus(start, 1, now)).toBe(true);
  });
});

describe("splitAddressEmail", () => {
  it("separates an email typed into the address line", () => {
    expect(
      splitAddressEmail("dclarinz2026@gmail.com, Malaybalay City, Bukidnon")
    ).toEqual({
      address: "Malaybalay City, Bukidnon",
      email: "dclarinz2026@gmail.com",
    });
  });

  it("keeps a normal address intact and takes the email from the record", () => {
    expect(
      splitAddressEmail("Purok 1, Malaybalay City", "juan@email.com")
    ).toEqual({
      address: "Purok 1, Malaybalay City",
      email: "juan@email.com",
    });
  });

  it("prefers the record's own email over one found in the address", () => {
    expect(
      splitAddressEmail("old@mail.com, Malaybalay City", "new@mail.com").email
    ).toBe("new@mail.com");
  });

  it("falls back to a dash when the address holds only an email", () => {
    expect(splitAddressEmail("solo@mail.com")).toEqual({
      address: "—",
      email: "solo@mail.com",
    });
  });

  it("returns a dash and no email for an empty address", () => {
    expect(splitAddressEmail("")).toEqual({ address: "—", email: "" });
  });
});

describe("planStatus", () => {
  it("reads a lapsed plan as forfeited", () => {
    expect(planStatus("lapsed")).toBe("Forfeited");
  });

  it("keeps every other standing active — behind is curable, settled is not forfeited", () => {
    for (const status of [
      "current",
      "reinstated",
      "delinquent_30",
      "delinquent_60",
      "delinquent_90",
      "fully_paid",
    ]) {
      expect(planStatus(status)).toBe("Active");
    }
  });
});
