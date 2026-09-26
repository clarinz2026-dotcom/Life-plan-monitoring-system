/**
 * SOA alignment probe — renders generateSOAHTML in Chromium and measures each
 * Payment History column: header vs. cell x-positions and text alignment.
 * Read-only; generates no data.
 */
import { chromium } from "playwright";
import { generateSOAHTML } from "../src/components/SOADocument";
import type { SOAData } from "../src/components/SOADocument";

const DAY = 86_400_000;
const data: SOAData = {
  clientName: "Dela Cruz, Juan P.",
  clientAddress: "Purok 1, Malaybalay City",
  clientContact: "0917 000 0000",
  beneficiaries: [{ name: "Dela Cruz, Maria P.", age: 45, relationship: "Spouse" }],
  contracts: [
    {
      contractNumber: "1463",
      planType: "Life Plan",
      planAmount: 30000,
      monthlyAmortization: 500,
      totalPaid: 1500,
      contractStatus: "current",
      startDate: new Date("2026-06-25").getTime(),
    },
  ],
  payments: [
    { paymentDate: new Date("2026-06-25").getTime(), amount: 500, paymentChannel: "cash", orNumber: "00123", contractNumber: "1463" },
    { paymentDate: Date.now() - 40 * DAY, amount: 500, paymentChannel: "gcash", orNumber: "00124", contractNumber: "1463" },
    { paymentDate: Date.now(), amount: 500, paymentChannel: "cash", orNumber: "00125", contractNumber: "1463" },
  ],
  generatedDate: "09/26/2026",
  accountNumber: "0001",
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
await page.setContent(generateSOAHTML(data), { waitUntil: "networkidle" });

const report = await page.evaluate(() => {
  const tables = document.querySelectorAll("table.grid");
  const payment = tables[tables.length - 1];
  const heads = Array.from(payment.querySelectorAll("thead th"));
  const firstCells = Array.from(payment.querySelectorAll("tbody tr:first-child td"));
  const out: Record<string, unknown>[] = [];
  let bodyWidth = 0;

  heads.forEach((th, i) => {
    const hb = th.getBoundingClientRect();
    const cb = firstCells[i]?.getBoundingClientRect();
    bodyWidth = payment.getBoundingClientRect().width;
    const thStyle = getComputedStyle(th);
    const tdStyle = firstCells[i] ? getComputedStyle(firstCells[i]) : null;
    out.push({
      col: th.textContent!.replace(/\s+/g, " ").trim(),
      widthPct: +(100 * hb.width / bodyWidth).toFixed(1),
      headerAlign: thStyle.textAlign,
      cellAlign: tdStyle?.textAlign ?? "—",
      // Horizontal offset between the header's left edge and the cell's left
      // edge; 0 means perfectly stacked.
      leftEdgeDelta: cb ? +(cb.left - hb.left).toFixed(1) : "—",
    });
  });
  return { bodyWidth, columns: out };
});

console.log("=== SOA Payment History geometry ===");
console.log(`table width: ${report.bodyWidth}px`);
for (const c of report.columns) {
  console.log(
    `${String(c.col).padEnd(26)} width=${String(c.widthPct).padEnd(5)}% header=${String(c.headerAlign).padEnd(7)} cell=${String(c.cellAlign).padEnd(7)} Δleft=${c.leftEdgeDelta}`
  );
}
const norm = (a: string) => (a === "start" ? "left" : a === "end" ? "right" : a);
const misaligned = report.columns.filter(
  (c) =>
    norm(String(c.headerAlign)) !== norm(String(c.cellAlign)) ||
    Math.abs(Number(c.leftEdgeDelta)) > 1
);
console.log(
  misaligned.length === 0
    ? "\nAll columns aligned: headers match cell geometry."
    : `\n${misaligned.length} column(s) misaligned: ${misaligned.map((c) => c.col).join(", ")}`
);
await browser.close();
if (misaligned.length > 0) process.exitCode = 1;
