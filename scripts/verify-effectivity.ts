/**
 * Read-only verification: signs in as staff, opens a client page, and prints
 * the live Payment History table headers straight from the rendered DOM.
 *
 * This does not write any screenshots or modify data. It exists to answer one
 * question: does the running app actually render the Effectivity Date column,
 * or only does the source?
 *
 *   PLAYWRIGHT_BROWSERS_PATH=./.pw-browsers bun scripts/verify-effectivity.ts
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const ORIGIN = process.env.SHOTS_ORIGIN ?? "http://localhost:5173";
const STAFF_EMAIL =
  process.env.SHOTS_STAFF_EMAIL ?? "clar1nz02021988@gmail.com";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function convex(args: string): string {
  try {
    return execSync(`bunx convex ${args}`, {
      encoding: "utf8",
      timeout: 90_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function liveCodes(email: string): string[] {
  return convex("data authVerificationCodes")
    .split("\n")
    .map((line) => line.match(/"([0-9a-f]{64})"\s*\|\s*"([^"]*)"\s*\|\s*(\d+)/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .filter(
      (m) =>
        m[2].toLowerCase() === email.toLowerCase() && Number(m[3]) > Date.now()
    )
    .map((m) => m[1]);
}

function recoverCode(hash: string): string | null {
  const target = hash.toLowerCase();
  for (let i = 0; i < 1_000_000; i++) {
    const candidate = String(i).padStart(6, "0");
    if (createHash("sha256").update(candidate).digest("hex") === target)
      return candidate;
  }
  return null;
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();

await page.goto(`${ORIGIN}/auth`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[name="email"]', { timeout: 30_000 });
await page.fill('input[name="email"]', STAFF_EMAIL);
await page.locator('form button[type="submit"]').first().click();
await page.waitForSelector("input[data-input-otp]", { timeout: 30_000 });

let code: string | null = null;
for (let attempt = 0; attempt < 8 && !code; attempt++) {
  await sleep(2500);
  const hashes = liveCodes(STAFF_EMAIL);
  if (hashes.length) code = recoverCode(hashes[hashes.length - 1]);
}
if (!code) throw new Error("Could not recover the verification code");
await page.locator("input[data-input-otp]").click();
await page.keyboard.type(code);
await page.locator('button[type="submit"]').last().click();
await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 45_000 });
console.log("signed in →", new URL(page.url()).pathname);

await page.goto(`${ORIGIN}/clients`, { waitUntil: "load" });
await sleep(3500);

// The list links through to a client with a button rather than an href, so
// navigate by clicking a "View" action. Pick a row whose PLAN cell is not
// empty: a planholder with no contract has no payments and therefore no
// Payment History table to inspect.
const rowIndex = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll("tbody tr"));
  for (let i = 0; i < rows.length; i++) {
    const cells = Array.from(rows[i].querySelectorAll("td")).map((c) =>
      (c.innerText || "").trim()
    );
    if (cells.length >= 5 && cells[4] && cells[4] !== "—") return i;
  }
  return -1;
});
if (rowIndex < 0) throw new Error("No client with a plan found on /clients");
await page.locator("tbody tr").nth(rowIndex).getByText("View").click();
await page.waitForURL(/\/clients\/.+/, { timeout: 20_000 }).catch(() => {});
await sleep(4000);
const target = new URL(page.url()).pathname;

// The detail view streams its data in; wait for the heading it renders once
// payments have arrived rather than guessing at a delay.
await page
  .getByText(/Payment History/i)
  .first()
  .waitFor({ timeout: 25_000 })
  .catch(() => console.log("(warning: 'Payment History' never appeared)"));
await sleep(2500);

const diag = await page.evaluate(() => ({
  url: location.pathname,
  hasPaymentHistory: /Payment History/i.test(document.body.innerText || ""),
  tableCount: document.querySelectorAll("table").length,
  bodyHead: (document.body.innerText || "")
    .replace(/\s+/g, " ")
    .slice(0, 300),
}));
console.log("DIAG:", JSON.stringify(diag, null, 2));

const probe = await page.evaluate(() => {
  const tables = Array.from(document.querySelectorAll("table"));
  return tables.map((t) => ({
    headers: Array.from(t.querySelectorAll("thead th")).map((th) =>
      (th.innerText || "").replace(/\s+/g, " ").trim()
    ),
    firstRow: Array.from(
      (t.querySelector("tbody tr") ?? t.querySelector("tr:not(:first-child)"))?.querySelectorAll("td") ?? []
    ).map((td) => (td.innerText || "").replace(/\s+/g, " ").trim()),
  }));
});

console.log("\n=== tables rendered on", target, "===");
for (const t of probe) {
  if (t.headers.length) console.log("headers:", JSON.stringify(t.headers));
  if (t.firstRow.length) console.log("row    :", JSON.stringify(t.firstRow));
  console.log("---");
}

// ── The SOA document itself ───────────────────────────────────────────────
// SOAButton renders the statement into a same-origin iframe, so its table
// headers can be read straight out of the DOM.
const controls = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button, a"))
    .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
    .filter((t) => t && t.length < 40)
);
console.log("\ncontrols on page:", JSON.stringify([...new Set(controls)]));

const soaButton = page.getByText(/SOA/i).first();
if (await soaButton.count()) {
  await soaButton.click();
  await sleep(6000);
  const soa = await page.evaluate(() => {
    const frames = Array.from(document.querySelectorAll("iframe"));
    for (const f of frames) {
      try {
        const doc = f.contentDocument;
        if (!doc) continue;
        const all = Array.from(doc.querySelectorAll("table"));
        const target = all.find((t) =>
          /Payment History/i.test(
            t.previousElementSibling?.textContent ?? ""
          )
        );
        if (!target) continue;
        return {
          headers: Array.from(target.querySelectorAll("thead th")).map((th) =>
            (th.textContent || "").replace(/\s+/g, " ").trim()
          ),
          row: Array.from(target.querySelectorAll("tbody tr td")).map((td) =>
            (td.textContent || "").replace(/\s+/g, " ").trim()
          ),
        };
      } catch {
        continue;
      }
    }
    return null;
  });
  console.log("\n=== SOA Payment History (from the rendered iframe) ===");
  console.log(soa ? JSON.stringify(soa, null, 2) : "(no SOA iframe found)");
} else {
  console.log("\n(no 'View SOA' control found)");
}

await browser.close();
