/**
 * Landing wordmark probe — loads the real landing page and measures the two
 * company lockups (header and footer) so "the tagline is Pacifico italic and
 * still sits under the name" is checked against the rendered page, not the
 * stylesheet alone. Read-only; renders no app data.
 */
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
// Pacifico is a webfont; measuring before it lands would read the fallback.
await page.evaluate(() => document.fonts.ready);

const report = await page.evaluate(() => {
  const lockups = [...document.querySelectorAll("p.font-brand")].map((p) => {
    const style = getComputedStyle(p);
    const rect = p.getBoundingClientRect();
    return {
      text: p.textContent?.trim() ?? "",
      family: style.fontFamily,
      style: style.fontStyle,
      size: style.fontSize,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });

  // Is each tagline actually sitting under its company name?
  const pairs = [...document.querySelectorAll("p.font-brand")]
    .filter((p) => p.textContent?.trim() === "Evangelist")
    .map((name) => {
      const tagline = name.nextElementSibling as HTMLElement | null;
      if (!tagline) return null;
      const a = name.getBoundingClientRect();
      const b = tagline.getBoundingClientRect();
      return {
        tagline: tagline.textContent?.trim() ?? "",
        startsAtSameLeft: Math.abs(a.left - b.left) < 2,
        isBelow: b.top >= a.bottom - 1,
        nameSize: getComputedStyle(name).fontSize,
        taglineSize: getComputedStyle(tagline).fontSize,
      };
    });

  return { lockups, pairs, total: document.querySelectorAll("p.font-brand").length };
});

const picksPacifico = (v: string) => /(^|["\s])Pacifico\b/i.test(v.trim());
const checks: [string, boolean][] = [
  ["both lockups found", report.total >= 4],
  [
    "every company-name line is Pacifico",
    report.lockups.filter((l) => l.text === "Evangelist").every((l) => picksPacifico(l.family)),
  ],
  [
    "every tagline is Pacifico",
    report.lockups.filter((l) => l.text === "Funeral Services").every((l) => picksPacifico(l.family)),
  ],
  [
    "every tagline is italic",
    report.lockups.filter((l) => l.text === "Funeral Services").every((l) => /italic/i.test(l.style)),
  ],
  [
    "the company name is not italic",
    report.lockups.filter((l) => l.text === "Evangelist").every((l) => !/italic/i.test(l.style)),
  ],
  ["taglines pair with a name", report.pairs.filter(Boolean).length >= 2],
  [
    "tagline sits below its name",
    report.pairs.filter(Boolean).every((p) => p!.isBelow && p!.startsAtSameLeft),
  ],
  [
    "tagline is set smaller than the name",
    report.pairs
      .filter(Boolean)
      .every((p) => parseFloat(p!.taglineSize) < parseFloat(p!.nameSize)),
  ],
  ["no page errors", errors.length === 0],
];

let bad = 0;
for (const [label, ok] of checks) {
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
}
console.log("");
for (const l of report.lockups) {
  console.log(`  "${l.text}" ${l.size} ${l.style} ${l.width}x${l.height}px ${picksPacifico(l.family) ? "Pacifico" : "?? " + l.family}`);
}
if (errors.length) console.log("  page errors:", errors);
console.log(bad === 0 ? "\nLanding wordmark renders as expected." : `\n${bad} check(s) failed.`);

await browser.close();
process.exit(bad === 0 ? 0 : 1);
