/**
 * Font probe — loads the app's real stylesheet in Chromium and reports the
 * computed font family for the elements the staff area is built from, so a
 * "everything is Arial" claim is checked against the cascade rather than
 * assumed. Read-only; renders no app data.
 */
import { chromium } from "playwright";

/** The dev server serves index.css as a JS module; recover the raw CSS. */
const res = await fetch("http://localhost:5173/src/index.css");
if (!res.ok) throw new Error(`dev server not reachable (${res.status})`);
const js = await res.text();
const match = js.match(/__vite__css = ("(?:[^"\\]|\\.)*")/);
if (!match) throw new Error("could not extract the stylesheet from the dev server");
const css = JSON.parse(match[1]) as string;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body></body></html>");
await page.addStyleTag({ content: css });

const report = await page.evaluate(() => {
  const root = document.createElement("div");
  root.className = "staff-shell";
  root.innerHTML = `
    <h1>Page title</h1>
    <h3>Section</h3>
    <p class="text-sm">Body copy</p>
    <div data-slot="card"><div data-slot="card-title">Card title</div></div>
    <button data-slot="button">Action</button>
    <table><tbody><tr><th data-slot="table-head">HEAD</th><td>Cell</td></tr></tbody></table>
    <p class="font-figures text-4xl font-bold">₱39,000.00</p>
    <ul><li>List item</li></ul>
    <label>Label</label>
    <input value="input" />
  `;
  document.body.appendChild(root);

  const portal = document.createElement("div");
  portal.className = "portal-shell";
  portal.innerHTML = `<h1>Portal</h1><p>Portal copy</p>`;
  document.body.appendChild(portal);

  // The public marketing pages are deliberately not Arial — check that too.
  const landing = document.createElement("div");
  landing.innerHTML = `<p class="font-display text-3xl">Marketing headline</p>`;
  document.body.appendChild(landing);

  const pick = (sel: string, scope: ParentNode = root) => {
    const el = scope.querySelector(sel);
    if (!el) return `${sel}: NOT FOUND`;
    return getComputedStyle(el).fontFamily;
  };

  return {
    staff: {
      h1: pick("h1"),
      h3: pick("h3"),
      p: pick("p.text-sm"),
      cardTitle: pick("[data-slot='card-title']"),
      button: pick("button"),
      th: pick("th"),
      td: pick("td"),
      figures: pick(".font-figures"),
      li: pick("li"),
      label: pick("label"),
      input: pick("input"),
    },
    portal: { h1: pick("h1", portal), p: pick("p", portal) },
    landing: pick(".font-display", landing),
  };
});

const isArial = (v: string) => /Arial/i.test(v) && !/Georgia|Times/i.test(v);
let bad = 0;
console.log("staff shell:");
for (const [k, v] of Object.entries(report.staff)) {
  const ok = isArial(v);
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${k.padEnd(10)} ${v}`);
}
console.log("portal shell:");
for (const [k, v] of Object.entries(report.portal)) {
  const ok = isArial(v);
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${k.padEnd(10)} ${v}`);
}
console.log("landing (.font-display, expected serif):", report.landing);
console.log(bad === 0 ? "\nAll staff + portal elements resolve to Arial." : `\n${bad} element(s) are not Arial.`);

await browser.close();
process.exit(bad === 0 ? 0 : 1);
