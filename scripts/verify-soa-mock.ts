/**
 * Structural probe for the redesigned SOA: dumps rendered text order, checks
 * the ten payment columns line up with their headers, and confirms the
 * mock's section flow. Read-only.
 */
import { chromium } from "playwright";
import { generateSOAHTML, type SOAData } from "../src/components/SOADocument";

const data: SOAData = {
  clientName: "ABRASALDO, CLARINZ",
  clientAddress: "Purok 21 Casisang",
  clientContact: "09123456789",
  clientBirthDate: "June 2, 2002",
  clientAge: 24,
  beneficiaries: [],
  branchName: "Malaybalay",
  salesAgent: "",
  contracts: [
    {
      contractNumber: "1463",
      planType: "St. Isidore",
      planAmount: 30000,
      monthlyAmortization: 500,
      totalPaid: 2500,
      contractStatus: "current",
      startDate: new Date("2026-08-22").getTime(),
    },
  ],
  payments: [
    { paymentDate: new Date("2026-09-26").getTime(), amount: 500, paymentChannel: "cash", orNumber: "012345", contractNumber: "1463" },
    { paymentDate: new Date("2026-09-26").getTime(), amount: 500, paymentChannel: "cash", orNumber: "012346", contractNumber: "1463" },
    { paymentDate: new Date("2026-09-26").getTime(), amount: 500, paymentChannel: "cash", orNumber: "012347", contractNumber: "1463" },
  ],
  generatedDate: "09/26/2026",
  accountNumber: "0001",
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1123 } });
await page.setContent(generateSOAHTML(data), { waitUntil: "networkidle" });

const report = await page.evaluate(() => {
  const text = (sel: string) =>
    Array.from(document.querySelectorAll(sel)).map((el) =>
      (el.textContent ?? "").replace(/\s+/g, " ").trim()
    );

  // Column geometry: header vs first body cell.
  const payment = document.querySelectorAll("table.soa-grid")[0];
  const heads = Array.from(payment?.querySelectorAll("thead th") ?? []);
  const cell = payment?.querySelector("tbody tr td");
  const widths = heads.map(
    (th) => +(100 * th.getBoundingClientRect().width / payment!.getBoundingClientRect().width).toFixed(1)
  );
  const aligns = heads.map((th) => getComputedStyle(th).textAlign);

  const summary = Array.from(document.querySelectorAll(".summary .val")).map(
    (v) => (v.textContent ?? "").replace(/\s+/g, " ").trim()
  );

  return {
    letterhead: text(".lh-brand, .lh-sub"),
    title: text(".doc-title"),
    bars: text(".sec-bar"),
    fieldLabels: text(".fld-label"),
    headers: heads.map((h) => (h.textContent ?? "").replace(/\s+/g, " ").trim()),
    widths,
    aligns,
    summary,
    font: getComputedStyle(document.body).fontFamily,
    moneyFormat: document.body.textContent?.includes("PHP 30,000.00"),
  };
});

console.log("letterhead:", report.letterhead);
console.log("title:", report.title);
console.log("section bars:", report.bars);
console.log("account fields:", report.fieldLabels.join(" | "));
console.log("payment headers:", report.headers);
console.log("column widths %:", report.widths.join(", "), "(sum:", report.widths.reduce((a, b) => a + b, 0), ")");
console.log("header aligns:", report.aligns.join(","));
console.log("summary values:", report.summary);
console.log("body font:", report.font);
console.log("PHP money format present:", report.moneyFormat);

const ok =
  report.bars.join("|") === "Account Information|Payment History|Account Summary" &&
  report.headers.join("|") ===
    "Payment Date|LPA Number|Effectivity Date|Due Date|Amount|Aging|Installment No.|O.R. No.|Balance|Remarks" &&
  report.summary.join("|") ===
    "PHP 30,000.00|PHP 2,500.00|PHP 27,500.00|Advanced" &&
  report.moneyFormat === true;
console.log(ok ? "\nOK — matches the mock's structure" : "\nMISMATCH — inspect above");
await browser.close();
if (!ok) process.exitCode = 1;
