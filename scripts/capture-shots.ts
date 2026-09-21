/**
 * Captures real screenshots of the running app into `public/shots/`, which the
 * /deck page then embeds into the PowerPoint.
 *
 * Two sessions are used, because the product has two doors:
 *
 *   1. a staff account — landing page, dashboard, clients, payments, account
 *      linking, bulk upload;
 *   2. a client account that is already linked to a planholder — the portal
 *      screens.
 *
 * Sign-in is genuine: the one-time code is emailed normally, and this script
 * reads the sha256 hash that `@convex-dev/auth` stores in
 * `authVerificationCodes` and searches the 6-digit space for the matching code.
 * That is only possible because the code space is trivially small — it is a
 * convenience for local capture, not a security property to rely on.
 *
 * Where the app comes from:
 *   - if the dev server is serving on `SHOTS_ORIGIN`, it is used directly;
 *   - otherwise the existing `dist/` build is served to the browser through
 *     Playwright request interception (no server process is started), with its
 *     bundled Convex URL rewritten to this project's linked deployment so the
 *     screenshots show this project's data.
 *
 * Run:  bun run capture:shots
 */
import { chromium, type Browser, type Page, type Route } from "playwright";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const ORIGIN = process.env.SHOTS_ORIGIN ?? "http://localhost:5173";
const DIST = "dist";
const OUT = "public/shots";
const W = 1600;
const H = 900;

/** Staff session: the account whose branch scope covers everything. */
const STAFF_EMAIL = process.env.SHOTS_STAFF_EMAIL ?? "clar1nz02021988@gmail.com";
/** Client session: any email already linked to a planholder record. */
const CLIENT_EMAIL = process.env.SHOTS_CLIENT_EMAIL ?? "clarinz2026@gmail.com";

const STAFF_SHOTS: [string, string][] = [
  ["landing", "/"],
  ["dashboard", "/dashboard"],
  ["clients", "/clients"],
  ["payments", "/payments"],
  ["linking", "/account-links"],
  ["bulk", "/bulk-upload"],
  ["client-detail", "/clients"],
];

const CLIENT_SHOTS: [string, string][] = [
  ["portal", "/portal/plans"],
  ["portal-link", "/portal/link-account"],
];

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

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

/** The deployment this project is linked to, as cloud + websocket URLs. */
function linkedDeployment(): { cloud: string; ws: string } | null {
  const site = convex("env get SITE_URL").trim();
  const name = site.match(/https:\/\/([a-z0-9-]+)\.convex\.site/)?.[1];
  return name ? { cloud: `https://${name}.convex.cloud`, ws: `wss://${name}.convex.cloud` } : null;
}

function liveCodes(email: string): string[] {
  return convex("data authVerificationCodes")
    .split("\n")
    .map((line) => line.match(/"([0-9a-f]{64})"\s*\|\s*"([^"]*)"\s*\|\s*(\d+)/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .filter((m) => m[2].toLowerCase() === email.toLowerCase() && Number(m[3]) > Date.now())
    .map((m) => m[1]);
}

function recoverCode(hash: string): string | null {
  const target = hash.toLowerCase();
  for (let i = 0; i < 1_000_000; i++) {
    const candidate = String(i).padStart(6, "0");
    if (createHash("sha256").update(candidate).digest("hex") === target) return candidate;
  }
  return null;
}

async function isServing(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Serves the static build from memory, pointing it at this project. */
function makeBuildServer(deployment: { cloud: string; ws: string }) {
  return async function serve(route: Route) {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    let file = join(DIST, pathname === "/" ? "index.html" : pathname);
    if (!existsSync(file) || !statSync(file).isFile()) file = join(DIST, "index.html");
    const ext = extname(file);

    const body =
      ext === ".js" || ext === ".html"
        ? Buffer.from(
            readFileSync(file, "utf8")
              .replace(/https:\/\/[a-z0-9-]+\.convex\.cloud/g, deployment.cloud)
              .replace(/wss:\/\/[a-z0-9-]+\.convex\.cloud/g, deployment.ws)
          )
        : readFileSync(file);

    await route.fulfill({
      status: 200,
      contentType: MIME[ext] ?? "application/octet-stream",
      body,
    });
  };
}

/** Hides the platform's development overlay so it never appears in a shot. */
async function hideOverlays(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const z = Number(el.style.zIndex);
      if (Number.isFinite(z) && z >= 9000) el.style.display = "none";
    });
  });
}

async function shoot(page: Page, id: string, label: string) {
  await hideOverlays(page);
  await sleep(400);
  const info = await page.evaluate(() => {
    const text = (document.body.innerText || "").replace(/\s+/g, " ").trim();
    return { length: text.length, tail: text.slice(-170) };
  });
  const buf = await page.screenshot();
  writeFileSync(`${OUT}/${id}.png`, buf);
  console.log(`   ${id}.png (${Math.round(buf.length / 1024)} KB)  ${label}`);
  console.log(`      chars=${info.length} | ...${info.tail}`);
}

/** Signs in as `email` and photographs the given routes. */
async function captureSession(
  browser: Browser,
  email: string,
  shots: [string, string][],
  clientId: string | null,
  serve?: (route: Route) => Promise<void>
) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  if (serve) await page.route(`${ORIGIN}/**`, serve);

  console.log(`→ signing in as ${email}`);
  await page.goto(`${ORIGIN}/auth`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="email"]', { timeout: 30_000 });
  await page.fill('input[name="email"]', email);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForSelector("input[data-input-otp]", { timeout: 30_000 });

  let code: string | null = null;
  for (let attempt = 0; attempt < 8 && !code; attempt++) {
    await sleep(2500);
    const hashes = liveCodes(email);
    if (hashes.length) code = recoverCode(hashes[hashes.length - 1]);
  }
  if (!code) throw new Error(`Could not recover the verification code for ${email}`);

  await page.locator("input[data-input-otp]").click();
  await page.keyboard.type(code);
  await page.locator('button[type="submit"]').last().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 45_000 });
  console.log("   signed in →", new URL(page.url()).pathname);

  for (const [id, route] of shots) {
    const target = id === "client-detail" && clientId ? `/clients/${clientId}` : route;
    await page.goto(ORIGIN + target, { waitUntil: "load" });
    await sleep(3000);
    await shoot(page, id, target);
  }

  await context.close();
}

// ── Run ────────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });

const usingDevServer = await isServing(ORIGIN);
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
let serve: ((route: Route) => Promise<void>) | undefined;

if (usingDevServer) {
  console.log(`→ using the dev server at ${ORIGIN}`);
} else {
  const deployment = linkedDeployment();
  if (!deployment) throw new Error("Could not determine the linked Convex deployment");
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(
      `No dev server at ${ORIGIN} and no build in ${DIST}/. Start the preview, or build once, then re-run.`
    );
  }
  console.log(`→ dev server is down; serving ${DIST}/ against ${deployment.cloud}`);
  serve = makeBuildServer(deployment);
}

/*
 * A client record worth photographing: one that actually has a contract and
 * payments, rather than a freshly imported row with an empty ledger.
 */
function pickClientId(): string | null {
  const lines = convex("data clients").split("\n").filter((l) => l.startsWith('"'));
  const withActivity = lines.find((l) => /Santos/i.test(l));
  const chosen = withActivity ?? lines[0];
  return chosen?.match(/^"([a-z0-9]{32})"/)?.[1] ?? null;
}

const clientId = pickClientId();
if (clientId) console.log("→ client record for the detail shot:", clientId);

await captureSession(browser, STAFF_EMAIL, STAFF_SHOTS, clientId, serve);
await captureSession(browser, CLIENT_EMAIL, CLIENT_SHOTS, null, serve);

await browser.close();
console.log("done — screenshots written to", OUT);
