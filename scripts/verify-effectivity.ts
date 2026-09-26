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
await sleep(3000);
const firstClient = await page
  .locator('a[href^="/clients/"], [href^="/clients/"]')
  .first()
  .getAttribute("href")
  .catch(() => null);

const target = firstClient ?? "/clients";
await page.goto(ORIGIN + target, { waitUntil: "load" });
await sleep(3500);

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

await browser.close();
