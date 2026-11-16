import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import sharp from "sharp";
import React from "react";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// In-memory cache for master template assets so generation takes < 25ms
let cachedCleanTemplate: Buffer | null = null;
let cachedBadge: Buffer | null = null;
let cachedTroutDataUri = "";

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

function getTroutLogoUri(): string {
  if (cachedTroutDataUri) return cachedTroutDataUri;
  try {
    const filePath = path.join(process.cwd(), "public", "icon-192.png");
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      cachedTroutDataUri = `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch (e) {
    console.warn("Could not read icon-192.png:", e);
  }
  return cachedTroutDataUri;
}

function createAmountBoxSvg(numAmount: number, customLabel?: string | null): Buffer {
  const formattedAmount = Number(numAmount).toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(numAmount) ? 0 : 2,
    maximumFractionDigits: 2,
  });

  const label =
    customLabel || (numAmount > 0 ? "Amount (Locked)" : "Direct Payment");

  // Center calculation for Rupee icon + Amount text in right compartment (x=175 to 427, center=301)
  const charCount = formattedAmount.length;
  const estTextWidth = charCount * 14.5;
  const totalAmountWidth = 24 + 6 + estTextWidth;
  const groupStartX = Math.max(185, Math.round(301 - totalAmountWidth / 2));

  return Buffer.from(`
    <svg width="427" height="52" viewBox="0 0 427 52" xmlns="http://www.w3.org/2000/svg">
      <rect width="427" height="52" rx="16" fill="#eef9fd" stroke="#bde6ef" stroke-width="1.5" />
      
      <!-- Left Label -->
      <text x="88" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="600" fill="#334155" text-anchor="middle">${label}</text>
      
      <!-- Divider -->
      <line x1="175" y1="13" x2="175" y2="39" stroke="#cbd5e1" stroke-width="1.5" />
      
      <!-- Right Amount Group -->
      <g transform="translate(${groupStartX}, 13)">
        <svg x="0" y="3" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f6266" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4.5 4.5 0 0 0 0-9H6" />
        </svg>
        <text x="28" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="25" font-weight="800" fill="#0f6266">${formattedAmount}</text>
      </g>
    </svg>
  `);
}

/**
 * GET /api/hdfc-qr?amount=580
 * Generates the official, photorealistic Urban Trout x HDFC Bank SmartHub Vyapar
 * standee poster matching the master design uploaded by the management, with:
 * - Alpine lake and underwater rainbow trout mountain artwork
 * - Pure vector high-error-correction QR code locked to exact amount
 * - Center trout emblem inside QR
 * - Dynamic locked amount box and instant HDFC Soundbox announcement note
 * - Instant full-screen display for Apple Shortcuts Quick Look
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawAmountStr = searchParams.get("amount") || searchParams.get("am") || "0";
    const cleanedAmountStr = rawAmountStr.replace(/,/g, "").trim();
    const numAmount = parseFloat(cleanedAmountStr) || 0;
    const format = (searchParams.get("format") || "jpeg").toLowerCase();
    const customLabel = searchParams.get("label");
    const note = searchParams.get("note") || searchParams.get("tn") || "Urban Trout Fresh Fish";

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

    // JSON response if format=json requested
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

    // Attempt high-fidelity sharp composite onto the master design template
    const { cleanTemplate, badge } = getMasterAssets();

    if (cleanTemplate && badge) {
      // 1. Generate 310x310 pure QR code buffer with H-level error correction
      const qrBuffer = await QRCode.toBuffer(upiUri, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 310,
        color: { dark: "#000000", light: "#ffffff" },
      });

      // 2. Generate vector SVG amount box
      const amountSvg = createAmountBoxSvg(numAmount, customLabel);

      // 3. Composite into the final master standee image
      let sharpPipeline = sharp(cleanTemplate).composite([
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

      const jpegOutput = await sharpPipeline.jpeg({ quality: 95 }).toBuffer();
      return new Response(new Uint8Array(jpegOutput), {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // Fallback: If template file is unavailable, use next/og pure vector ImageResponse
    const qrObj = QRCode.create(upiUri, { errorCorrectionLevel: "H" });
    const modules = qrObj.modules;
    const size = modules.size;
    const data = modules.data;

    let qrPath = "";
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[y * size + x]) {
          qrPath += `M${x + 1} ${y + 1}h1v1h-1z `;
        }
      }
    }
    const viewBoxSize = size + 2;

    const formattedAmount = Number(numAmount).toLocaleString("en-IN", {
      minimumFractionDigits: Number.isInteger(numAmount) ? 0 : 2,
      maximumFractionDigits: 2,
    });

    const troutLogoUri = getTroutLogoUri();

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 720,
            height: 1280,
            backgroundColor: "#020d12",
            alignItems: "center",
            padding: "18px 24px",
            justifyContent: "space-between",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              backgroundColor: "#061d28",
              border: "2px solid #0284c7",
              borderRadius: "22px",
              padding: "14px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  width: 26,
                  height: 26,
                  backgroundColor: "#004c8f",
                  borderRadius: 4,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 13,
                    height: 13,
                    backgroundColor: "#ed1c24",
                    border: "2px solid #ffffff",
                  }}
                />
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#ffffff" }}>
                HDFC BANK
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#38bdf8",
                  backgroundColor: "#0c334d",
                  borderRadius: 6,
                  padding: "2px 8px",
                }}
              >
                SmartHub Vyapar
              </span>
            </div>
            <div style={{ display: "flex", marginTop: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 900, color: "#ffffff" }}>
                ₹ {formattedAmount}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 660,
              height: 860,
              borderRadius: "24px",
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <svg
              viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
              width="480"
              height="480"
              style={{ display: "flex" }}
            >
              <path fill="#000000" d={qrPath} />
            </svg>
            {troutLogoUri ? (
              <img
                src={troutLogoUri}
                width={80}
                height={80}
                style={{ position: "absolute", borderRadius: 16 }}
              />
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 11,
              color: "#64748b",
            }}
          >
            <span>UPI ID: {upiId}</span>
            <span>Malabagh, Srinagar • Soundbox Voice Confirmed</span>
          </div>
        </div>
      ),
      {
        width: 720,
        height: 1280,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (err: any) {
    console.error("Error generating HDFC Bank QR poster:", err);
    return new Response("Failed to generate HDFC Bank QR poster", { status: 500 });
  }
}
