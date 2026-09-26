/**
 * PDF-path probe — runs the app's real html2canvas pipeline in the dev server
 * and compares the live DOM geometry with what the capture contains, so the
 * downloaded PDF's narrow tables can be traced to a cause. Read-only.
 * Requires scripts/soa-pdf-probe.html to be served by the dev server.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto("http://localhost:5173/scripts/soa-pdf-probe.html", {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, {
  timeout: 20000,
});

const result = (await page.evaluate(() =>
  (window as unknown as { __probe: () => Promise<Record<string, unknown>> }).__probe(),
)) as {
  live: { soaW: number; tables: { head: string; w: number; cssWidth: string; layout: string }[] };
  fonts: { playfairAvailable: boolean; loadedFaces: string[] };
  canvasW: number;
  canvasH: number;
  drawnBands: { y: number; h: number; x0: number; x1: number; w: number }[];
  dataUrl: string;
};

console.log("live #soa width:", result.live.soaW);
console.log("live tables:");
for (const t of result.live.tables) {
  console.log(`   ${String(t.w).padStart(4)}px  css=${t.cssWidth}  ${t.layout}  ${t.head}`);
}
console.log("Playfair available:", result.fonts.playfairAvailable);
console.log("font faces:", result.fonts.loadedFaces.join(" | ") || "(none)");
console.log("canvas:", result.canvasW, "x", result.canvasH);
console.log("drawn bands (canvas px, expect full width ~", result.canvasW - 40, "):");
for (const b of result.drawnBands) {
  console.log(
    `   y=${String(b.y).padStart(4)} h=${String(b.h).padStart(3)}  x=${String(b.x0).padStart(4)}..${String(b.x1).padStart(4)}  w=${b.w}`,
  );
}

writeFileSync("scripts/out-soa-capture.png", Buffer.from(result.dataUrl.split(",")[1], "base64"));
console.log("wrote scripts/out-soa-capture.png");

await browser.close();
