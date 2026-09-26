/**
 * Wordmark font probe — loads the app's real stylesheet in Chromium and
 * reports the computed font family for the company name and for surrounding
 * staff/portal text, so "the wordmark is Pacifico and nothing else moved" is
 * checked against the cascade. Read-only; renders no app data.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { compile } from "@tailwindcss/node";

/**
 * Prefer the dev server (source of truth). When it is not running, compile
 * src/index.css locally with the same Tailwind pipeline the Vite plugin uses.
 */
async function loadCss(): Promise<{ css: string; source: string }> {
  try {
    const res = await fetch("http://localhost:5173/src/index.css");
    if (res.ok) {
      const js = await res.text();
      const match = js.match(/__vite__css = ("(?:[^"\\]|\\.)*")/);
      if (match) return { css: JSON.parse(match[1]) as string, source: "dev server :5173" };
    }
  } catch {
    // fall through to the local build
  }

  // Only the utility classes this probe renders are needed: every rule that
  // decides font-family lives in index.css itself (.font-brand, .font-figures,
  // the .staff-shell / .portal-shell blocks), so there is no value in scanning
  // the whole tree here.
  const candidates = [
    "font-brand", "font-figures", "font-display", "font-bold", "font-semibold",
    "truncate", "uppercase", "block", "leading-none", "text-sm", "text-white",
    "text-evergreen", "text-stone", "text-4xl", "text-3xl", "text-xl", "text-xs", "text-2xl",
    "text-[15px]", "text-[23px]", "italic", "leading-none",
  ];
  const compiler = await compile(readFileSync("src/index.css", "utf8"), {
    base: process.cwd(),
    onDependency: () => {},
  });
  return { css: compiler.build(candidates), source: `local Tailwind build of src/index.css (${candidates.length} candidates)` };
}

const { css, source } = await loadCss();
console.log(`stylesheet: ${source}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body></body></html>");
await page.addStyleTag({ content: css });

const report = await page.evaluate(() => {
  const root = document.createElement("div");
  root.className = "staff-shell";
  root.innerHTML = `
    <aside>
      <span class="font-brand truncate text-[17px] leading-none text-white">Evangelist</span>
      <span class="truncate text-[10px] uppercase">Staff Portal</span>
    </aside>
    <h1>Dashboard</h1>
    <p class="text-sm">Body copy</p>
    <p class="font-figures text-4xl font-bold">₱39,000.00</p>
  `;
  document.body.appendChild(root);

  const portal = document.createElement("div");
  portal.className = "portal-shell";
  portal.innerHTML = `<span class="font-brand block text-[18px] text-evergreen">Evangelist</span><p>Portal copy</p>`;
  document.body.appendChild(portal);

  // The landing wordmark lockup: company name over the tagline.
  const landing = document.createElement("div");
  landing.innerHTML = `
    <p class="font-brand text-[23px] leading-none text-evergreen">Evangelist</p>
    <p class="font-brand mt-1 text-[15px] italic leading-none text-stone">Funeral Services</p>
  `;
  document.body.appendChild(landing);

  const family = (el: Element | null) => (el ? getComputedStyle(el).fontFamily : "NOT FOUND");
  return {
    wordmarkStaff: family(root.querySelector(".font-brand")),
    wordmarkPortal: family(portal.querySelector(".font-brand")),
    sidebarCaption: family(root.querySelector("aside span:last-child")),
    h1: family(root.querySelector("h1")),
    p: family(root.querySelector("p.text-sm")),
    figures: family(root.querySelector(".font-figures")),
    portalCopy: family(portal.querySelector("p")),
    landingWordmark: family(landing.querySelector("p.font-brand")),
    landingTagline: family(landing.querySelector("p.font-brand.italic")),
    landingTaglineStyle: landing.querySelector("p.font-brand.italic")
      ? getComputedStyle(landing.querySelector("p.font-brand.italic")).fontStyle
      : "NOT FOUND",
    hasBrayles: document.documentElement.innerHTML.includes("Brayles"),
  };
});

// Chromium normalizes the stack to unquoted `Pacifico, Arial, ...`, so accept
// Pacifico with any quoting as the leading family.
const picksPacifico = (v: string) => /(^|["\s])Pacifico\b/i.test(v.trim());
const isArial = (v: string) => /Arial/i.test(v) && !/Georgia|Times|Pacifico/i.test(v);

const checks: [string, string, boolean][] = [
  ["staff wordmark", report.wordmarkStaff, picksPacifico(report.wordmarkStaff)],
  ["portal wordmark", report.wordmarkPortal, picksPacifico(report.wordmarkPortal)],
  ["sidebar caption", report.sidebarCaption, isArial(report.sidebarCaption)],
  ["staff h1", report.h1, isArial(report.h1)],
  ["staff body copy", report.p, isArial(report.p)],
  ["staff figures", report.figures, isArial(report.figures)],
  ["portal body copy", report.portalCopy, isArial(report.portalCopy)],
  ["landing wordmark", report.landingWordmark, picksPacifico(report.landingWordmark)],
  ["landing tagline", report.landingTagline, picksPacifico(report.landingTagline)],
  ["landing tagline is italic", report.landingTaglineStyle, /italic/i.test(report.landingTaglineStyle)],
];

let bad = 0;
for (const [label, value, ok] of checks) {
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(17)} ${value}`);
}
console.log("  Brayles still referenced anywhere in the DOM:", report.hasBrayles);
console.log(bad === 0 ? "\nWordmark resolves to Pacifico; everything else is still Arial." : `\n${bad} check(s) failed.`);

await browser.close();
process.exit(bad === 0 ? 0 : 1);
