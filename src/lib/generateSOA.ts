import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { generateSOAHTML, type SOAData } from "@/components/SOADocument";

export async function generateSOAPDF(data: SOAData): Promise<void> {
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
  container.innerHTML = generateSOAHTML(data);
  document.body.appendChild(container);

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