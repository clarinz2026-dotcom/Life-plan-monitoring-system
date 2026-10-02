import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { generateSOAHTML, type SOAData } from "@/components/SOADocument";

/** A generated statement, ready to hand to the browser. */
export type PreparedSOAPDF = {
  blob: Blob;
  filename: string;
};

/**
 * How the file was delivered, so callers can word the confirmation honestly.
 *
 * `blocked` means we could not confirm a handoff: the app is framed, opening a
 * tab was refused, and a programmatic download in that situation is silently
 * discarded rather than reported as an error.
 */
export type DeliveryMode = "download" | "tab" | "blocked";

/**
 * True when the app is running inside a frame — which is how the preview and
 * any embedded deployment serve it.
 *
 * This matters because a sandboxed iframe without `allow-downloads` silently
 * swallows programmatic downloads: `jsPDF.save()` (and an `<a download>` click)
 * resolve without error and nothing lands on disk. There is no way to detect
 * that from script, so when framed we hand the PDF over as a real file URL in
 * a new tab instead, where the browser's viewer can save it.
 */
export function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent: reading `window.top` throws, which only happens
    // when we are framed.
    return true;
  }
}

/** `SOA_Dela_Cruz_Juan_P_2026-09-16.pdf` */
export function soaFilename(data: SOAData): string {
  const clientName = data.clientName.replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr = new Date().toISOString().split("T")[0];
  return `SOA_${clientName}_${dateStr}.pdf`;
}

/**
 * Hand an already-generated PDF to the browser.
 *
 * Kept separate from generation on purpose: this part must run *synchronously*
 * inside the click handler, while the browser still considers the click a user
 * gesture. Generating first and delivering after several `await`s lets that
 * activation lapse, which browsers can refuse to honour for both downloads and
 * `window.open`.
 */
export function deliverPDF({ blob, filename }: PreparedSOAPDF): DeliveryMode {
  const url = URL.createObjectURL(blob);
  // Revoking immediately can blank the PDF viewer / abort the download, so let
  // the URL outlive the handoff.
  const release = () => window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

  const framed = isFramed();
  if (framed) {
    const opened = window.open(url, "_blank");
    if (opened) {
      release();
      return "tab";
    }
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  // Append to <html>, not <body>: Radix's modal dialog sets
  // `pointer-events: none` on <body> and marks outside siblings inert while a
  // dialog is open, and we generate this from inside one.
  (document.documentElement || document.body).appendChild(link);
  link.click();
  link.remove();
  release();

  // Inside a frame a blocked download reports nothing back, so the caller must
  // not claim success. Still click: the frame may permit downloads even when it
  // forbids popups.
  return framed ? "blocked" : "download";
}

/**
 * Convert a logo URL to a base64 data URL so html2canvas can always embed it
 * in the PDF (cross-origin images can otherwise render blank). Returns the
 * original value for data: URLs, and null when the fetch fails.
 */
export async function toDataURL(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Resolve `promise`, but never wait longer than `ms`. */
function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    promise.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

/**
 * Wait until the container's external stylesheets, webfonts and images have
 * settled. Without this, html2canvas rasterizes immediately and the letterhead
 * is captured in its fallback face (or the logo comes out blank).
 */
async function waitForAssets(container: HTMLElement): Promise<void> {
  // 1. Stylesheets declared inside the injected markup (Google Fonts).
  const links = Array.from(
    container.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
  );
  await withTimeout(
    Promise.all(
      links.map(
        (link) =>
          new Promise<void>((resolve) => {
            if (link.sheet) return resolve();
            link.addEventListener("load", () => resolve(), { once: true });
            link.addEventListener("error", () => resolve(), { once: true });
          })
      )
    ),
    2500
  );

  // 2. Wait for the letterhead font before capturing the statement, then wait
  //    for the company logo image.
  await withTimeout(
    document.fonts.load('700 25px "Brayles"').then(() => undefined),
    2500
  );

  await withTimeout(
    Promise.all(
      Array.from(container.querySelectorAll("img")).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
      )
    ),
    2500
  );
}

/**
 * Rasterize the statement and return it as a PDF blob.
 *
 * Prefer building this ahead of the click (see `SOAButton`): generation is slow
 * — it renders off-screen, waits on fonts and walks the whole document — and
 * delaying the download past the user's click is exactly what makes browsers
 * drop it.
 */
export async function generateSOAPDFBlob(data: SOAData): Promise<PreparedSOAPDF> {
  // Embed the logo as a data URL so it renders reliably inside the PDF.
  const logoUrl = data.logoUrl ? await toDataURL(data.logoUrl) : null;
  const renderData: SOAData = logoUrl ? { ...data, logoUrl } : data;

  // The document must be painted inside the viewport for html2canvas to
  // capture it — placing it off-screen (e.g. top/left: -9999px) is a known
  // cause of blank PDFs. We attach it at (0,0) behind the page (z-index -1)
  // so it renders fully without ever being visible to the user.
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "900px"; // 880px statement + 10px each side
  container.style.background = "white";
  container.style.zIndex = "-1";
  container.style.pointerEvents = "none";
  container.innerHTML = generateSOAHTML(renderData);
  document.body.appendChild(container);

  try {
    // Let the letterhead webfont and logo finish loading before rasterizing.
    await waitForAssets(container);

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      // Match the container: the statement is 880px wide, and capturing any
      // narrower crops its right-hand columns (REMARKS). jsPDF then scales
      // the raster to the page's 198mm content width, so the PDF stays A4.
      width: 900,
      windowWidth: 900,
      scrollX: 0,
      scrollY: 0,
    });

    // A zero-sized canvas means the capture failed. Fail loudly here rather
    // than emitting a one-page PDF of nothing.
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("The statement could not be rendered — please try again.");
    }

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Narrow page margins keep the statement airy but fit the ten-column
    // payment ledger with room to breathe — requested by the office.
    const margin = 6; // mm on every side
    const contentWidth = pdfWidth - margin * 2; // 198mm
    const contentHeight = pdfHeight - margin * 2; // 285mm

    // Slice the tall canvas into page-sized bands. Handing jsPDF the whole
    // image once per page (the previous approach) embeds the full-resolution
    // PNG repeatedly and bloats the file.
    const pxPerMm = canvas.width / contentWidth;
    const sliceHeightPx = Math.floor(contentHeight * pxPerMm);
    const pageCount = Math.max(1, Math.ceil(canvas.height / sliceHeightPx));
    let pageCanvas = canvas;

    for (let page = 0; page < pageCount; page++) {
      const sliceTop = page * sliceHeightPx;
      const sliceHeight = Math.min(sliceHeightPx, canvas.height - sliceTop);

      // Reuse the source canvas itself when there is only one page.
      if (pageCount > 1) {
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceHeight;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(
          canvas,
          0,
          sliceTop,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
        pageCanvas = slice;
      }

      if (page > 0) pdf.addPage();
      pdf.addImage(
        pageCanvas,
        "PNG",
        margin,
        margin,
        contentWidth,
        (sliceHeight / canvas.width) * contentWidth
      );
    }

    return { blob: pdf.output("blob"), filename: soaFilename(data) };
  } finally {
    document.body.removeChild(container);
  }
}
