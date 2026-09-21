import { snapdom } from "@zumer/snapdom";
import type { ShotImage, ShotId, ShotMap } from "./systemDeck";

/**
 * Captures real screenshots of the app's own pages, inside the browser.
 *
 * A hidden, same-origin <iframe> loads each route — which means it inherits the
 * signed-in session from localStorage — and once the page has finished loading
 * its data, the rendered DOM is rasterised with snapdom (a modern alternative
 * to html2canvas that understands Tailwind v4's `color-mix()` and `oklch()`
 * colours, both of which html2canvas chokes on).
 *
 * Everything happens locally in the browser: nothing is uploaded, and no
 * screenshot of live client data is ever written into the repository.
 */

/** Capture viewport. 16:10 keeps captures close to the deck's image frames. */
const VIEWPORT_W = 1600;
const VIEWPORT_H = 900;

/** How long to wait for a page's own queries to paint before giving up. */
const SETTLE_TIMEOUT_MS = 12000;

export interface ShotSlot {
  id: ShotId;
  /** Short name shown in the capture list. */
  label: string;
  /** Route to load for the automatic capture. */
  route: string;
  /** Where this image lands in the deck. */
  usedOn: string;
  /** Which sign-in produces the best version of this screen. */
  asRole: "public" | "staff" | "client";
}

export const SHOT_SLOTS: ShotSlot[] = [
  {
    id: "landing",
    label: "Website landing page",
    route: "/",
    usedOn: "Cover",
    asRole: "public",
  },
  {
    id: "clients",
    label: "Clients list",
    route: "/clients",
    usedOn: "Slide 3 · The daily loop",
    asRole: "staff",
  },
  {
    id: "dashboard",
    label: "Staff dashboard",
    route: "/dashboard",
    usedOn: "Slide 4 · Monitoring",
    asRole: "staff",
  },
  {
    id: "payments",
    label: "Payments & receipts",
    route: "/payments",
    usedOn: "Slide 5 · The money thread",
    asRole: "staff",
  },
  {
    id: "portal",
    label: "Client portal — My Plans",
    route: "/portal/plans",
    usedOn: "Slide 6 · Client side",
    asRole: "client",
  },
  {
    id: "linking",
    label: "Account Linking",
    route: "/account-links",
    usedOn: "Slide 7 · Account linking",
    asRole: "staff",
  },
  {
    id: "bulk",
    label: "Bulk Upload",
    route: "/bulk-upload",
    usedOn: "Slide 8 · Records migration",
    asRole: "staff",
  },
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function waitForLoad(iframe: HTMLIFrameElement, route: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`${route} took too long to load.`));
    }, SETTLE_TIMEOUT_MS + 8000);

    const cleanup = () => {
      window.clearTimeout(timer);
      iframe.removeEventListener("load", onLoad);
      iframe.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Could not open ${route}.`));
    };

    iframe.addEventListener("load", onLoad);
    iframe.addEventListener("error", onError);
  });
}

/**
 * Waits until the route has actually painted content. The iframe's `load` event
 * fires when the bundle has run, but Convex queries resolve afterwards, so
 * polling for real text is far more reliable than a fixed delay.
 */
async function waitForContent(doc: Document): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const text = doc.body?.innerText?.trim() ?? "";
    // Ignore the empty shell (route fallback says just "Loading").
    if (text.length > 120 && !/^loading$/i.test(text)) return;
    await sleep(200);
  }
}

/**
 * Hides the platform's development overlay. It renders at z-index 9998/99999,
 * which the product itself never uses, so an inline-style check is enough and
 * avoids the cost of resolving computed styles for every node.
 */
function hidePlatformOverlays(doc: Document) {
  doc.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const z = Number(el.style.zIndex);
    if (Number.isFinite(z) && z >= 9000) {
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
    }
  });
}

/** Crops a full-page canvas down to the captured viewport. */
function cropToViewport(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = Math.min(source.width, VIEWPORT_W);
  const h = Math.min(source.height, VIEWPORT_H);
  if (w === source.width && h === source.height) return source;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0, w, h, 0, 0, w, h);
  return out;
}

/** Captures one route exactly as it renders for the current session. */
export async function captureRoute(slot: ShotSlot): Promise<ShotImage> {
  const iframe = document.createElement("iframe");
  iframe.title = `Capture ${slot.label}`;
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = [
    "position:fixed",
    "top:0",
    `left:-${VIEWPORT_W + 400}px`,
    `width:${VIEWPORT_W}px`,
    `height:${VIEWPORT_H}px`,
    "border:0",
    "pointer-events:none",
  ].join(";");
  iframe.src = slot.route;
  document.body.appendChild(iframe);

  try {
    await waitForLoad(iframe, slot.route);

    const doc = iframe.contentDocument;
    if (!doc || !doc.body) throw new Error(`Could not read ${slot.route}.`);

    await waitForContent(doc);
    if (!doc.body.innerText.trim()) {
      throw new Error(
        `${slot.route} rendered empty — check that you are signed in with the right account.`
      );
    }

    hidePlatformOverlays(doc);
    // Let the browser apply the hide and settle any last layout shifts.
    await sleep(300);

    const canvas = await snapdom.toCanvas(doc.documentElement, { dpr: 1 });
    const cropped = cropToViewport(canvas);
    const dataUrl = cropped.toDataURL("image/png");
    if (!dataUrl || dataUrl.length < 100) throw new Error(`Could not rasterise ${slot.route}.`);

    return { dataUrl, width: cropped.width, height: cropped.height };
  } finally {
    iframe.remove();
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(blob);
  });
}

function measure(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("That image could not be decoded."));
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  });
}

/**
 * Screenshots that ship next to the app in `public/shots/`.
 *
 * Any that are present are loaded automatically, so the deck already carries
 * real screens of the system without anyone having to press a button. Missing
 * slots are simply skipped — those slides keep their flow diagram.
 */
export async function loadBundledShots(): Promise<ShotMap> {
  const entries = await Promise.all(
    SHOT_SLOTS.map(async (slot): Promise<[ShotId, ShotImage] | null> => {
      try {
        const res = await fetch(`/shots/${slot.id}.png`, { cache: "no-store" });
        if (!res.ok) return null;
        const blob = await res.blob();
        /*
         * The dev server answers unknown paths with index.html, so a 200 alone
         * proves nothing — the content type is the real check.
         */
        if (!blob.type.startsWith("image/")) return null;
        const dataUrl = await blobToDataUrl(blob);
        return [slot.id, { dataUrl, ...(await measure(dataUrl)) }];
      } catch {
        return null;
      }
    })
  );

  const out: ShotMap = {};
  for (const entry of entries) if (entry) out[entry[0]] = entry[1];
  return out;
}

/** Reads a screenshot the user supplied by hand, so it can replace a capture. */
export function fileToShot(file: File): Promise<ShotImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const img = new Image();
      img.onerror = () => reject(new Error("That file is not a readable image."));
      img.onload = () =>
        resolve({ dataUrl, width: img.naturalWidth || 1600, height: img.naturalHeight || 900 });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
