"use client";

/**
 * Client-side 1-click A4 PDF generator.
 * Converts a DOM element into a crisp, single-page A4 PDF and triggers direct browser download.
 */
export async function downloadElementAsSinglePagePdf(
  elementId: string,
  filename: string = "UrbanTrout-Invoice.pdf",
  options?: {
    quality?: number;
    scale?: number;
    marginMm?: number;
  }
): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found for PDF export.`);
    return false;
  }

  try {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    // Hide any elements with class 'print:hidden' or 'pdf-exclude' temporarily during capture
    const hiddenElements = element.querySelectorAll<HTMLElement>(".print\\:hidden, .pdf-exclude");
    const originalDisplays: string[] = [];
    hiddenElements.forEach((el, idx) => {
      originalDisplays[idx] = el.style.display;
      el.style.display = "none";
    });

    const scale = options?.scale ?? 2; // 2x resolution for crisp 300 DPI text & seal
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: element.scrollWidth,
    });

    // Restore hidden elements immediately
    hiddenElements.forEach((el, idx) => {
      el.style.display = originalDisplays[idx] || "";
    });

    // A4 Portrait dimensions: 210mm x 297mm
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = options?.marginMm ?? 8; // 8mm margin
    const printableWidth = pageWidth - margin * 2; // 194mm
    const printableHeight = pageHeight - margin * 2; // 281mm

    const imgWidth = printableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Strict 1-Page Constraint: If content height exceeds printable A4 height, scale down proportionally
    let finalWidth = imgWidth;
    let finalHeight = imgHeight;

    if (finalHeight > printableHeight) {
      const scaleFactor = printableHeight / finalHeight;
      finalHeight = printableHeight;
      finalWidth = finalWidth * scaleFactor;
    }

    // Center horizontally on page
    const posX = margin + (printableWidth - finalWidth) / 2;
    const posY = margin + (finalHeight < printableHeight ? 2 : 0);

    const imgData = canvas.toDataURL("image/jpeg", options?.quality ?? 0.95);
    pdf.addImage(imgData, "JPEG", posX, posY, finalWidth, finalHeight, undefined, "FAST");

    // Direct browser download
    const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (err) {
    console.error("Failed to generate direct A4 PDF:", err);
    // Graceful fallback to browser print if canvas generation fails
    if (typeof window !== "undefined") {
      window.print();
    }
    return false;
  }
}
