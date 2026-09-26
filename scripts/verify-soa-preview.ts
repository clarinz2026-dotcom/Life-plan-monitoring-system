/**
 * SOA preview fit probe — reproduces the dialog's scaled preview frame
 * (fixed 774px document width, transform: scale to fit the box) at several
 * dialog widths, and reports whether the document is cropped, squeezed, or
 * breaks payment-history headers mid-word. Read-only; generates no data.
 */
import { chromium } from "playwright";
import { generateSOAHTML } from "../src/components/SOADocument";
import type { SOAData } from "../src/components/SOADocument";

const data: SOAData = {
  clientName: "Abraasaldo, Clarinz",
  clientAddress: "Malaybalay City, Bukidnon",
  clientEmail: "clarinz2026@gmail.com",
  clientContact: "09353991034",
  clientBirthDate: "June 2, 2002",
  clientAge: 24,
  generatedDate: "September 26, 2026",
  accountNumber: "0001",
  beneficiaries: [],
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
  payments: Array.from({ length: 4 }, (_, i) => ({
    paymentDate: new Date("2026-09-26").getTime(),
    amount: 650,
    paymentChannel: "cash",
    orNumber: `0012${3 + i}`,
    contractNumber: "0012345",
  })),
};

const DOC = 774;
const browser = await chromium.launch();

for (const boxWidth of [380, 576, 848]) {
  const scale = Math.min(1, boxWidth / DOC);
  const page = await browser.newPage({ viewport: { width: boxWidth, height: 700 } });
  const html = generateSOAHTML(data)
    .replace("</body>", "")
    .replace(
      "<body>",
      `<body><div id="box" style="width:${boxWidth}px;height:600px;overflow:hidden">
       <iframe id="f" style="width:${DOC}px;height:${600 / scale}px;border:0;transform:scale(${scale});transform-origin:top left"></iframe></div>`,
    )
    .replace(
      "</html>",
      `<script>document.getElementById('f').srcdoc = ${JSON.stringify(
        "<!DOCTYPE html>" + generateSOAHTML(data).replace(/^[\s\S]*?<body>/, "").replace("</body>", "").replace("</html>", ""),
      )};</script></body></html>`,
    );
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  const box = await page.evaluate(() => {
    const outer = document.getElementById("box") as HTMLElement;
    const f = document.getElementById("f") as HTMLIFrameElement;
    const doc = f.contentDocument;
    const soa = doc?.getElementById("soa") as HTMLElement | null;
    const table = Array.from(doc?.querySelectorAll("table.soa-grid") ?? []).find((t) =>
      /payment date/i.test(t.textContent || ""),
    ) as HTMLElement | undefined;
    const ths = table
      ? (Array.from(table.querySelectorAll("thead th")) as HTMLElement[])
      : [];
    const boxRect = outer.getBoundingClientRect();
    const fRect = f.getBoundingClientRect();
    return {
      boxW: Math.round(boxRect.width),
      frameVisualW: Math.round(fRect.width),
      frameVisualH: Math.round(fRect.height),
      docW: soa ? Math.round(soa.getBoundingClientRect().width) : 0,
      docScrollW: doc?.documentElement.scrollWidth ?? 0,
      cropped: fRect.width > boxRect.width + 1,
      headH: ths[0] ? Math.round(ths[0].getBoundingClientRect().height) : 0,
      overflowCols: ths
        .filter((t) => t.scrollWidth > t.clientWidth + 1)
        .map((t) => (t.textContent || "").replace(/\s+/g, " ").trim()),
      brokenWords: ths.filter((t) => t.getClientRects().length > 2).length,
      bodyRows: table?.querySelectorAll("tbody tr").length ?? 0,
    };
  });
  console.log(
    `box=${boxWidth}px scale=${scale.toFixed(3)} docW=${box.docW} frameVisual=${box.frameVisualW}x${box.frameVisualH} cropped=${box.cropped} headH=${box.headH} brokenHeaderCells=${box.brokenWords} overflowing=${JSON.stringify(box.overflowCols)} rows=${box.bodyRows}`,
  );
  await page.close();
}

await browser.close();
