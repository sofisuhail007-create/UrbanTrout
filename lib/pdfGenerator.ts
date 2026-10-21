"use client";

/**
 * Client-side 1-click A4 PDF generator using html-to-image + jsPDF.
 * Uses native browser SVG foreignObject rendering, which fully supports:
 * - Tailwind CSS v4 (oklch colors)
 * - Custom fonts & alpha-transparent PNGs (Urban Trout official seal)
 * - Strict 1-Page A4 scaling (mathematically guaranteed 1-page output)
 */
export async function downloadElementAsSinglePagePdf(
  elementId: string,
  filename: string = "UrbanTrout-Invoice.pdf",
  options?: {
    quality?: number;
    pixelRatio?: number;
    marginMm?: number;
  }
): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[pdfGenerator] Element with id "${elementId}" not found.`);
    return false;
  }

  try {
    // Ensure all <img> elements inside are fully loaded before capturing
    const images = Array.from(element.querySelectorAll("img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalHeight > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );

    const { toJpeg } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");

    const pixelRatio = options?.pixelRatio ?? 2; // 2x for sharp 300 DPI text & seal

    const imgData = await toJpeg(element, {
      quality: options?.quality ?? 0.95,
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
      filter: (node) => {
        // Exclude elements with print:hidden or pdf-exclude
        if (
          node instanceof HTMLElement &&
          (node.classList.contains("print:hidden") || node.classList.contains("pdf-exclude"))
        ) {
          return false;
        }
        return true;
      },
    });

    // Load image to determine exact aspect ratio
    const img = new Image();
    img.src = imgData;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
    });

    // Standard A4 Portrait dimensions: 210mm x 297mm
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = options?.marginMm ?? 6; // 6mm margin for maximum printable space
    const printableWidth = pageWidth - margin * 2; // 198mm
    const printableHeight = pageHeight - margin * 2; // 285mm

    const imgWidth = printableWidth;
    const imgHeight = (img.naturalHeight * imgWidth) / img.naturalWidth;

    // Strict 1-Page Constraint:
    // If the content height exceeds printable A4 height, scale down proportionally
    let finalWidth = imgWidth;
    let finalHeight = imgHeight;

    if (finalHeight > printableHeight) {
      const scaleFactor = printableHeight / finalHeight;
      finalHeight = printableHeight;
      finalWidth = finalWidth * scaleFactor;
    }

    // Center horizontally on page
    const posX = margin + (printableWidth - finalWidth) / 2;
    const posY = margin + (finalHeight < printableHeight ? 1 : 0);

    pdf.addImage(imgData, "JPEG", posX, posY, finalWidth, finalHeight, undefined, "FAST");

    // Direct browser file download
    const cleanFilename = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (err) {
    console.error("[pdfGenerator] Direct PDF export failed:", err);
    // DO NOT call window.print() here — user explicitly asked for direct PDF download without print dialog
    return false;
  }
}
