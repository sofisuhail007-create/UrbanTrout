import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import React from "react";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

let cachedTroutDataUri = "";
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

/**
 * GET /api/hdfc-qr?amount=580
 * Generates an executive, branded HDFC Bank SmartHub Vyapar merchant standee poster (PNG)
 * with pure-vector SVG QR code, official HDFC Bank identity, PayZapp & UPI app badges,
 * and high-contrast locked amount formatted for Apple Shortcuts Quick Look.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawAmountStr = searchParams.get("amount") || searchParams.get("am") || "0";
    const cleanedAmountStr = rawAmountStr.replace(/,/g, "").trim();
    const numAmount = parseFloat(cleanedAmountStr) || 0;
    const format = searchParams.get("format"); // "image" (default) | "raw" | "json"
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

    // Generate pure vector QR path (H-level error correction: 100% scannable even with center logo)
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

    const rupeeSvg = (
      <svg
        width="36"
        height="42"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginRight: 6, display: "flex" }}
      >
        <path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4.5 4.5 0 0 0 0-9H6" />
      </svg>
    );

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
          {/* Top Brand & Amount Card */}
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
              boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            }}
          >
            {/* HDFC Bank Official Brand Identity */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {/* Iconic HDFC Bank Emblem */}
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

              <span
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "1px",
                }}
              >
                HDFC BANK
              </span>

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#38bdf8",
                  backgroundColor: "#0c334d",
                  border: "1px solid #0284c7",
                  borderRadius: 6,
                  padding: "2px 8px",
                  letterSpacing: "0.5px",
                }}
              >
                SmartHub Vyapar
              </span>
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 11,
                color: "#38bdf8",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                marginTop: 6,
              }}
            >
              Official Soundbox Partner • Urban Trout
            </div>

            {/* Locked Amount Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 6,
              }}
            >
              {rupeeSvg}
              <span
                style={{
                  fontSize: 50,
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "-1px",
                }}
              >
                {formattedAmount}
              </span>
            </div>

            {/* Locked Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#064e3b",
                border: "1.5px solid #10b981",
                borderRadius: "999px",
                padding: "3px 14px",
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#a7f3d0",
                  letterSpacing: "0.5px",
                }}
              >
                {numAmount > 0
                  ? "EXACT AMOUNT LOCKED IN HDFC SOUNDBOX QR"
                  : "DIRECT HDFC SOUNDBOX UPI PAYMENT"}
              </span>
            </div>
          </div>

          {/* Center Elevated Standee Card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 660,
              height: 860,
              borderRadius: "24px",
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "22px 20px",
              boxShadow: "0 15px 40px rgba(0,0,0,0.5)",
            }}
          >
            {/* Card Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                alignItems: "center",
                borderBottom: "1.5px solid #e2e8f0",
                paddingBottom: 10,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                  Urban Trout Aquaculture
                </span>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                  Pioneering Kashmir&apos;s Cold-Water RAS Aquaculture • Live Harvested
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: 8,
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8" }}>
                  BHIM | UPI
                </span>
              </div>
            </div>

            {/* Vector QR Code with Center Trout Logo */}
            <div
              style={{
                display: "flex",
                position: "relative",
                alignItems: "center",
                justifyContent: "center",
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
                  style={{
                    position: "absolute",
                    borderRadius: 16,
                    border: "4px solid #ffffff",
                  }}
                />
              ) : null}
            </div>

            {/* Voice Soundbox Alert Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                backgroundColor: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: "10px",
                padding: "8px 12px",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: 15 }}>🔊</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#166534",
                  letterSpacing: "0.2px",
                }}
              >
                HDFC Soundbox will instantly announce payment of ₹{formattedAmount}
              </span>
            </div>

            {/* Supported UPI Apps */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#475569",
                  letterSpacing: "1.5px",
                }}
              >
                SCAN &amp; PAY WITH ANY UPI APP
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "8px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#1e293b",
                  }}
                >
                  GPay
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#5b21b6",
                  }}
                >
                  PhonePe
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0284c7",
                  }}
                >
                  Paytm
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    backgroundColor: "#004c8f",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#ffffff",
                  }}
                >
                  PayZapp
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#047857",
                  }}
                >
                  BHIM
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              padding: "0 8px",
              fontSize: 11,
              color: "#64748b",
              fontWeight: 600,
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
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Error generating HDFC Bank QR poster:", err);
    return new Response("Failed to generate HDFC Bank QR poster", { status: 500 });
  }
}
