/**
 * Portal Payment History table probe — renders the same markup/classes used in
 * src/pages/portal/Plans.tsx in Chromium and reports, per container width:
 * whether any cell wraps onto more than one line, and whether the table
 * overflows its scroll wrapper (horizontal scrollbar).
 * Read-only; generates no data.
 */
import { chromium } from "playwright";

const CELL = "border:1px solid #e6dfd1;padding:4px 8px;text-align:center;vertical-align:middle;font:11px Arial,Helvetica,sans-serif;";
const TH = "border:1px solid #e6dfd1;background:#eef2ee;padding:4px 8px;vertical-align:middle;text-align:center;font:700 9px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.03em;text-transform:uppercase;color:#1b4332;";

const WIDTHS = [
  ["PAYMENT DATE", "11%"],
  ["LPA NUMBER", "9.5%"],
  ["EFFECTIVITY DATE", "10.5%"],
  ["DUE DATE", "10%"],
  ["AMOUNT", "10.5%"],
  ["AGING", "9.5%"],
  ["INSTALLMENT NO.", "9%"],
  ["O.R. NO.", "9.5%"],
  ["BALANCE", "10%"],
  ["REMARKS", "11%"],
] as const;

const ROWS = [
  ["09/26/2026", "0012345", "08/22/2026", "09/22/2026", "₱650.00", "30", "1", "00123", "₱38,350.00", "1 installment payment"],
  ["09/26/2026", "0012345", "08/22/2026", "10/22/2026", "₱650.00", "Advanced", "2", "0012346", "₱37,700.00", "Cash"],
];

const html = (nowrap: boolean) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font-family:Arial,Helvetica,sans-serif}
  .wrap{overflow-x:auto;border:1px solid #e6dfd1}
  table{width:100%;table-layout:fixed;border-collapse:collapse}
  th{${TH}}
  td{${CELL}${nowrap ? "white-space:nowrap;" : ""}}
  td.num{font-weight:700;color:#1b4332}
  th.br{line-break:inside}
</style></head><body>
<div class="wrap"><table>
<colgroup>${WIDTHS.map(([, w]) => `<col style="width:${w}">`).join("")}</colgroup>
<thead><tr>${WIDTHS.map(([l]) => `<th class="br">${l}</th>`).join("")}</tr></thead>
<tbody>${ROWS.map(
    (r) => `<tr>${r
      .map((c, i) => `<td class="${i === 4 ? "num" : ""}">${c}</td>`)
      .join("")}</tr>`,
  ).join("")}</tbody>
</table></div></body></html>`;

const browser = await chromium.launch();

for (const nowrap of [true, false]) {
  for (const w of [640, 768, 900, 1200]) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } });
    await page.setContent(html(nowrap), { waitUntil: "load" });
    const r = await page.evaluate(() => {
      const wrap = document.querySelector(".wrap") as HTMLElement;
      const table = document.querySelector("table") as HTMLElement;
      const cells = Array.from(document.querySelectorAll("tbody td")) as HTMLElement[];
      const wrapped = cells
        .filter((c) => c.getClientRects().length > 1)
        .map((c) => `${c.textContent?.trim()} x${c.getClientRects().length}`);
      const heights = Array.from(
        document.querySelectorAll("tbody tr"),
      ).map((t) => Math.round((t as HTMLElement).getBoundingClientRect().height));
      return {
        tableW: Math.round(table.getBoundingClientRect().width),
        scrollW: wrap.scrollWidth,
        clientW: wrap.clientWidth,
        hscroll: wrap.scrollWidth > wrap.clientWidth + 1,
        rowH: heights,
        wrapped,
      };
    });
    console.log(
      `nowrap=${nowrap} view=${w}px table=${r.tableW} wrap=${r.clientW} hscroll=${r.hscroll} rowH=${r.rowH.join(",")} wrapped=[${r.wrapped.join(" | ")}]`,
    );
    await page.close();
  }
}

await browser.close();
