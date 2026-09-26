/**
 * SOA layout probe — renders generateSOAHTML in Chromium and reports the
 * Payment History header/body geometry: per-column width, whether the header
 * label overflows its cell, header vs. cell text alignment, and whether the
 * empty-state message is visible. Read-only; generates no data.
 */
import { chromium } from "playwright";
import { generateSOAHTML } from "../src/components/SOADocument";
import type { SOAData } from "../src/components/SOADocument";

const base: SOAData = {
  clientName: "Abraasaldo, Clarinz",
  clientAddress: "Malaybalay City, Bukidnon",
  clientEmail: "clarinz2026@gmail.com",
  clientContact: "09353991034",
  clientBirthDate: "June 2, 2002",
  clientAge: 24,
  generatedDate: "September 26, 2026",
  beneficiaries: [],
  accountNumber: "0001",
  contracts: [
    {
      contractNumber: "0012345",
      planType: "St. Isidore",
      planAmount: 39000,
      monthlyAmortization: 650,
      totalPaid: 2600,
      contractStatus: "current",
      startDate: new Date("2026-08-22").getTime(),
    },
  ],
  payments: [
    {
      paymentDate: new Date("2026-09-26").getTime(),
      amount: 650,
      paymentChannel: "cash",
      orNumber: "00123",
      contractNumber: "0012345",
    },
  ],
};

const browser = await chromium.launch();

for (const [label, data] of [
  ["with payments", base],
  ["no payments", { ...base, payments: [] }],
] as const) {
  const page = await browser.newPage({
    viewport: { width: Number(process.env.SOA_W ?? 900), height: 1400 },
  });
  await page.setContent(generateSOAHTML(data as SOAData), { waitUntil: "networkidle" });
  const report = await page.evaluate(() => {
    const table = Array.from(document.querySelectorAll("table.soa-grid")).find((t) =>
      /payment date/i.test(t.textContent || ""),
    ) as HTMLTableElement | undefined;
    if (!table) return { error: "payment history table not found" };
    const ths = Array.from(table.querySelectorAll("thead th")) as HTMLElement[];
    const firstRow = table.querySelector("tbody tr") as HTMLElement;
    const tds = firstRow
      ? (Array.from(firstRow.querySelectorAll("td")) as HTMLElement[])
      : [];
    const doc = document.querySelector(".doc") as HTMLElement;
    return {
      docW: doc ? Math.round(doc.getBoundingClientRect().width) : 0,
      tableW: Math.round(table.getBoundingClientRect().width),
      headH: Math.round(ths[0]?.getBoundingClientRect().height ?? 0),
      bodyRows: table.querySelectorAll("tbody tr").length,
      emptyMsg: (table.querySelector("td.empty")?.textContent || "").trim(),
      emptyVisible: (() => {
        const e = table.querySelector("td.empty") as HTMLElement | null;
        if (!e) return false;
        const r = e.getBoundingClientRect();
        return r.height > 0 && r.width > 0;
      })(),
      cols: ths.map((th, i) => {
        const cs = getComputedStyle(th);
        const td = tds[i];
        return {
          label: (th.textContent || "").replace(/\s+/g, " ").trim(),
          w: Math.round(th.getBoundingClientRect().width),
          lines: th.getClientRects().length,
          overflow: th.scrollWidth > th.clientWidth + 1,
          padT: cs.paddingTop,
          lh: cs.lineHeight,
          align: cs.textAlign,
          cellAlign: td ? getComputedStyle(td).textAlign : "-",
          dLeft: td
            ? Math.round(
                td.getBoundingClientRect().left -
                  th.getBoundingClientRect().left -
                  (parseFloat(getComputedStyle(td).paddingLeft) -
                    parseFloat(cs.paddingLeft)),
              )
            : null,
        };
      }),
    };
  });
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(report, null, 1));
  await page.close();
}

await browser.close();
