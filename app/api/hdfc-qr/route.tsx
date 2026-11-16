import { NextRequest } from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import glyphsData from "./glyphs.json";

export const dynamic = "force-dynamic";

// In-memory cache for master template assets so generation takes < 25ms
let cachedCleanTemplate: Buffer | null = null;
let cachedBadge: Buffer | null = null;

function getMasterAssets() {
  try {
    if (!cachedCleanTemplate) {
      const templatePath = path.join(
        process.cwd(),
        "public",
        "images",
        "hdfc_standee_master_clean.jpg"
      );
      if (fs.existsSync(templatePath)) {
        cachedCleanTemplate = fs.readFileSync(templatePath);
      }
    }

    if (!cachedBadge) {
      const badgePath = path.join(
        process.cwd(),
        "public",
        "images",
        "qr_center_badge.png"
      );
      if (fs.existsSync(badgePath)) {
        cachedBadge = fs.readFileSync(badgePath);
      }
    }
  } catch (e) {
    console.warn("Could not read template files for HDFC QR:", e);
  }

  return { cleanTemplate: cachedCleanTemplate, badge: cachedBadge };
}

/**
 * Converts text into pure vector SVG <path> elements using bundled font glyphs.
 * ZERO fontconfig/OS font dependency — 100% immune to serverless Linux tofu boxes!
 */
const em = glyphsData.unitsPerEm; // 2048
const glyphs = glyphsData.glyphs as Record<string, { d: string; width: number }>;

function textToSvgPaths(
  text: string,
  fontSize: number,
  startX: number,
  baselineY: number,
  fillColor: string
) {
  const scale = fontSize / em;
  let curX = startX;
  const paths: string[] = [];

  for (const ch of text) {
    if (ch === " ") {
      curX += 569 * scale;
      continue;
    }
    const g = glyphs[ch];
    if (!g) continue;
    if (g.d) {
      paths.push(
        `<path d="${g.d}" transform="translate(${curX.toFixed(2)}, ${baselineY.toFixed(2)}) scale(${scale.toFixed(5)}, -${scale.toFixed(5)})" fill="${fillColor}" />`
      );
    }
    curX += g.width * scale;
  }

  return { totalWidth: curX - startX, svg: paths.join("\n") };
}

/**
 * Builds the exact Amount Box as pure vector SVG geometry.
 * No <text> tags are used at all — every character is a raw geometric SVG path!
 */
function createVectorAmountBoxSvg(
  numAmount: number,
  customLabel?: string | null
): Buffer {
  const formattedAmount = Number(numAmount).toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(numAmount) ? 0 : 2,
    maximumFractionDigits: 2,
  });

  const label =
    customLabel || (numAmount > 0 ? "Amount (Locked)" : "Direct Payment");

  // Left label centered in left compartment (x: 0 to 175, center: 87.5)
  const { totalWidth: labelWidth } = textToSvgPaths(label, 15, 0, 0, "#334155");
  const labelStartX = Math.max(16, Math.round(87.5 - labelWidth / 2));
  const { svg: labelSvg } = textToSvgPaths(
    label,
    15,
    labelStartX,
    32,
    "#334155"
  );

  // Measure right amount numbers width
  const { totalWidth: amountNumWidth } = textToSvgPaths(
    formattedAmount,
    26,
    0,
    0,
    "#0f6266"
  );

  // Right container: x from 175 to 427 (width 252, center = 301)
  const totalRightWidth = 22 + 6 + amountNumWidth;
  const rightStartX = Math.round(301 - totalRightWidth / 2);
  const rupeeIconX = rightStartX;
  const numStartX = rightStartX + 22 + 6;

  // Pure vector Rupee symbol
  const rupeeSvg = `
    <g transform="translate(${rupeeIconX}, 14)">
      <svg width="22" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f6266" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4.5 4.5 0 0 0 0-9H6" />
      </svg>
    </g>
  `;

  // Render right amount digits as pure vector paths
  const { svg: amountSvgPaths } = textToSvgPaths(
    formattedAmount,
    26,
    numStartX,
    35,
    "#0f6266"
  );

  return Buffer.from(`
    <svg width="427" height="52" viewBox="0 0 427 52" xmlns="http://www.w3.org/2000/svg">
      <!-- Background container -->
      <rect width="427" height="52" rx="16" fill="#eef9fd" stroke="#bde6ef" stroke-width="1.5" />
      
      <!-- Divider line -->
      <line x1="175" y1="13" x2="175" y2="39" stroke="#cbd5e1" stroke-width="1.5" />
      
      <!-- Left Label (PURE VECTOR PATHS) -->
      ${labelSvg}
      
      <!-- Rupee Vector Icon -->
      ${rupeeSvg}
      
      <!-- Right Amount Numbers (PURE VECTOR PATHS) -->
      ${amountSvgPaths}
    </svg>
  `);
}

/**
 * GET /api/hdfc-qr?amount=580
 * Generates the official Urban Trout x HDFC Bank SmartHub Vyapar standee poster
 * matching the user's master design, with 100% pure vector paths for all text and amounts.
 * Zero font dependencies — guaranteed error-free on all operating systems and serverless environments.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawAmountStr = searchParams.get("amount") || searchParams.get("am") || "0";
    const cleanedAmountStr = rawAmountStr.replace(/,/g, "").trim();
    const numAmount = parseFloat(cleanedAmountStr) || 0;
    const format = (searchParams.get("format") || "jpeg").toLowerCase();
    const customLabel = searchParams.get("label");
    const note =
      searchParams.get("note") || searchParams.get("tn") || "Urban Trout Fresh Fish";

    // Official HDFC SmartHub Vyapar credentials
    const upiId = "Vyapar.178760132267@hdfcbank";
    const payeeName = "Urban Trout Aquaculture";
    const merchantRef = "STQU178760132267";
    const merchantCode = "8999";

    const upiUri =
      numAmount > 0
        ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&mc=${merchantCode}&tr=${merchantRef}&am=${numAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`
        : `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&mc=${merchantCode}&tr=${merchantRef}&cu=INR&tn=${encodeURIComponent(note)}`;

    // Raw QR Buffer if format=raw requested
    if (format === "raw") {
      const pngBuffer = await QRCode.toBuffer(upiUri, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 600,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      return new Response(new Uint8Array(pngBuffer), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // JSON metadata if format=json requested
    if (format === "json") {
      return new Response(
        JSON.stringify({
          success: true,
          bank: "HDFC Bank (SmartHub Vyapar)",
          vpa: upiId,
          amount: numAmount,
          upi_uri: upiUri,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // High-fidelity sharp composite onto the master design template
    const { cleanTemplate, badge } = getMasterAssets();

    if (cleanTemplate && badge) {
      // 1. Generate 310x310 pure QR code buffer with H-level error correction
      const qrBuffer = await QRCode.toBuffer(upiUri, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 310,
        color: { dark: "#000000", light: "#ffffff" },
      });

      // 2. Generate PURE VECTOR amount box (zero font dependencies!)
      const amountSvg = createVectorAmountBoxSvg(numAmount, customLabel);

      // 3. Composite into the final master standee image
      const sharpPipeline = sharp(cleanTemplate).composite([
        { input: qrBuffer, top: 315, left: 186 },
        { input: badge, top: 445, left: 315 },
        { input: amountSvg, top: 625, left: 133 },
      ]);

      if (format === "png") {
        const pngOutput = await sharpPipeline.png().toBuffer();
        return new Response(new Uint8Array(pngOutput), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }

      const jpegOutput = await sharpPipeline.jpeg({ quality: 96 }).toBuffer();
      return new Response(new Uint8Array(jpegOutput), {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return new Response("Template assets not available", { status: 500 });
  } catch (err: any) {
    console.error("Error generating HDFC Bank QR poster:", err);
    return new Response("Failed to generate HDFC Bank QR poster", { status: 500 });
  }
}
