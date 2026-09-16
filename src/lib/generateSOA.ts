import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { generateSOAHTML, type SOAData } from "@/components/SOADocument";

/**
 * Convert a logo URL to a base64 data URL so html2canvas can always embed it
 * in the PDF (cross-origin images can otherwise render blank). Returns the
 * original value for data: URLs, and null when the fetch fails.
 */
async function toDataURL(url: string): Promise<string | null> {
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
 * Wait until the document's external stylesheets, webfonts and images have
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
    4000
  );

  // 2. The letterhead face must be fetched before it can be painted.
  const fonts = document.fonts;
  if (fonts) {
    try {
      await withTimeout(fonts.load('700 30px "Playfair Display"'), 4000);
      await withTimeout(fonts.ready, 4000);
    } catch {
      // Fall through — Georgia is a perfectly good serif fallback.
    }
  }

  // 3. Images (the company logo).
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
    4000
  );
}

export async function generateSOAPDF(data: SOAData): Promise<void> {
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
  container.style.width = "794px"; // A4 width at 96 DPI
  container.style.background = "white";
  container.style.zIndex = "-1";
  container.style.pointerEvents = "none";
  container.innerHTML = generateSOAHTML(renderData);
  document.body.appendChild(container);

  // Let the letterhead webfont and logo finish loading before rasterizing.
  await waitForAssets(container);

  try {
    // Render HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
    });

    // Create PDF (A4 size in mm: 210 x 297)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth - 20; // 10mm margin on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10; // 10mm top margin

    // Add first page
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      10,
      position,
      imgWidth,
      imgHeight
    );
    heightLeft -= pdfHeight - 20;

    // Add additional pages if content is longer
    while (heightLeft > 0) {
      position = -(pdfHeight - 20) + 10;
      pdf.addPage();
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        10,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pdfHeight - 20;
    }

    // Generate filename
    const clientName = data.clientName.replace(/[^a-zA-Z0-9]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `SOA_${clientName}_${dateStr}.pdf`;

    // Download the PDF
    pdf.save(filename);
  } finally {
    // Clean up the temporary container
    document.body.removeChild(container);
  }
}