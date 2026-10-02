/**
 * SOA dialog crop probe — replicates the production preview in a real DOM:
 * the stock Radix DialogContent CSS (fixed/centered, w-full, grid, p-6, the
 * max-w-[calc(100%-2rem)] cap) plus the caller's width and grid-template
 * overrides, the dialog's 24px padding (p-6 — inlined because this probe runs
 * without the app stylesheet), the h-[62vh] box, and the scaled 880px iframe. Then measures the
 * statement's rendered right edge against the viewport: cropped = right edge
 * wider than the viewport. Read-only.
 */
import { chromium } from "playwright";
import { generateSOAHTML, type SOAData } from "../src/components/SOADocument";

const data: SOAData = {
  clientName: "AbrAsaldo, Clarinz",
  clientAddress: "Purok 21 Casisang Malaybalay City, Malaybalay City, Bukidnon",
  clientEmail: "clarinz2026@gmail.com",
  clientContact: "09563991034",
  clientBirthDate: "June 2, 2002",
  clientAge: 24,
  generatedDate: "September 26, 2026",
  accountNumber: "0001",
  beneficiaries: [],
  branchName: "Malaybalay",
  salesAgent: "R. Santos",
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

const DOC = 880;
const browser = await chromium.launch();

// Stock DialogContent classes minus the caller's sm:max-w-none, plus the
// caller's inline width and grid-template-columns override.
const CONTENT =
  "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] " +
  "translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6";

let failures = 0;

for (const viewport of [380, 640, 768, 1024, 1440]) {
  const page = await browser.newPage({ viewport: { width: viewport, height: 900 } });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0">
    <div id="content" class="${CONTENT}"
      style="width:min(94vw,928px);padding:24px;box-sizing:border-box;grid-template-columns:minmax(0,1fr)">
      <div id="box" style="height:62vh;width:100%;min-width:0;overflow:hidden;border-radius:12px;border:1px solid #ddd;background:#fff">
        <iframe id="frame" title="Statement of Account"
          style="height:100%;width:${DOC}px;max-width:none;border:0;display:block"></iframe>
      </div>
    </div>
    <script>
      const scale = Math.min(1, document.getElementById('box').clientWidth / ${DOC});
      const box = document.getElementById('box');
      const f = document.getElementById('frame');
      f.style.transform = 'scale(' + scale + ')';
      f.style.transformOrigin = 'top left';
      f.style.height = (box.clientHeight / scale) + 'px';
      f.srcdoc = ${JSON.stringify(generateSOAHTML(data))};
    </script>
  </body></html>`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const m = await page.evaluate(() => {
    const box = document.getElementById("box") as HTMLElement;
    const frame = document.getElementById("frame") as HTMLIFrameElement;
    const doc = frame.contentDocument!;
    const soa = doc.getElementById("soa") as HTMLElement;
    const boxR = box.getBoundingClientRect();
    // The iframe's OUTER rect is in viewport space and already includes the
    // parent CSS transform; rects inside the iframe are not (they live in the
    // frame's own coordinate system), so the statement is measured via its
    // untransformed offsetWidth and mapped through the frame's visual box.
    const fR = frame.getBoundingClientRect();
    const soaLayoutW = soa.offsetWidth; // internal space, unscaled
    const table = doc.querySelector("table.soa-grid") as HTMLElement;
    const ths = Array.from(table.querySelectorAll("thead th"));
    return {
      boxW: Math.round(boxR.width),
      boxRight: Math.round(boxR.right),
      frameVisualW: Math.round(fR.width),
      frameVisualRight: Math.round(fR.right),
      soaLayoutW,
      overflowCols: ths.filter((t) => t.scrollWidth > t.clientWidth + 1)
        .map((t) => (t.textContent || "").trim()),
    };
  });

  // Crop = the scaled frame's right edge passes the box's right edge.
  const cropped = m.frameVisualRight > m.boxRight + 1;
  const boxCropped = m.boxRight > viewport + 1;
  // Squeeze = the statement laid out narrower than its printed width inside
  // the frame (a CSS width fight), or the frame failed to fill the box.
  const squeezed = m.frameVisualW < m.boxW - 2 || m.soaLayoutW < DOC - 4;
  const ok = !cropped && !boxCropped && !squeezed && m.overflowCols.length === 0;
  if (!ok) failures++;
  console.log(
    `vw=${String(viewport).padStart(4)} box=${m.boxW}px frameVisual=${m.frameVisualW}px ` +
      `soa=${m.soaLayoutW}px frameRight=${m.frameVisualRight} boxRight=${m.boxRight} ` +
      `cropped=${cropped} boxOffscreen=${boxCropped} squeezed=${squeezed} ` +
      `overflowingCols=${JSON.stringify(m.overflowCols)} ${ok ? "OK" : "FAIL"}`
  );
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nAll viewports OK" : `\n${failures} viewport(s) FAIL`);
if (failures > 0) process.exitCode = 1;
