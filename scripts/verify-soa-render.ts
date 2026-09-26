/**
 * Renders the SOA document the app produces in a real browser and prints the
 * Payment History table headers. Confirms the document layout end-to-end
 * without depending on the dev server.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=./.pw-browsers bun scripts/verify-soa-render.ts
 */
import { chromium } from "playwright";
import { generateSOAHTML, type SOAData } from "../src/components/SOADocument";

const data = {
  clientName: "Bautista, Joseph",
  clientContact: "9501481472",
  clientAddress: "Malaybalay, Bukidnon",
  clientBirthDate: "January 1, 1970",
  clientEmail: "j@example.com",
  beneficiaries: [],
  contracts: [
    {
      contractNumber: "1463",
      planType: "St. Isidore",
      planAmount: 30000,
      monthlyAmortization: 500,
      totalPaid: 1500,
      contractStatus: "current",
      startDate: new Date(2026, 5, 25).getTime(),
    },
  ],
  payments: [
    {
      contractNumber: "1463",
      paymentDate: new Date(2026, 5, 25).getTime(),
      amount: 500,
      paymentChannel: "cash",
      orNumber: "00123",
    },
    {
      contractNumber: "1463",
      paymentDate: new Date(2026, 7, 10).getTime(),
      amount: 500,
      paymentChannel: "gcash",
      orNumber: "00124",
    },
    {
      contractNumber: "1463",
      paymentDate: new Date(2026, 8, 26).getTime(),
      amount: 500,
      paymentChannel: "cash",
      orNumber: "00125",
    },
  ],
  generatedDate: "September 26, 2026",
} as unknown as SOAData;

const html = generateSOAHTML(data);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
await page.setContent(html, { waitUntil: "load" });

const result = await page.evaluate(() => {
  const tables = Array.from(document.querySelectorAll("table.grid"));
  const target = tables.find((t) =>
    /Payment History/i.test(t.previousElementSibling?.textContent ?? "")
  );
  if (!target) return null;
  const rows = Array.from(target.querySelectorAll("tbody tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map((td) =>
      (td.textContent || "").trim()
    )
  );
  return {
    headers: Array.from(target.querySelectorAll("thead th")).map((th) =>
      (th.textContent || "").replace(/\s+/g, " ").trim()
    ),
    rows,
    tableWidth: Math.round(target.getBoundingClientRect().width),
    bodyWidth: Math.round(document.body.getBoundingClientRect().width),
  };
});

console.log("=== SOA Payment History as rendered in a browser ===");
console.log(JSON.stringify(result, null, 2));

await browser.close();
