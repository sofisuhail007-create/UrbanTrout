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
 * GET /api/jk-qr?amount=200
 * Generates an executive, branded J&K Bank merchant standee poster (PNG)
 * with a pure-vector SVG QR code, official J&K Bank branding, supported app badges,
 * and high-contrast locked amount formatted for iPhone Shortcuts Quick Look.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const amountStr = searchParams.get("amount") || searchParams.get("am") || "0";
    const numAmount = parseFloat(amountStr) || 0;

    const upiId = "JKBMERC00828895@jkb";
    const upiUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Aquaculture&am=${numAmount > 0 ? numAmount.toFixed(2) : "0"}&cu=INR&tn=Urban%20Trout%20Fresh%20Fish`;

    // Generate pure vector QR path (H-level error correction: 100% reliable)
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
    const centerPos = (viewBoxSize - 12) / 2;

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
        stroke="#10b981"
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
              border: "2px solid #10b981",
              borderRadius: "22px",
              padding: "14px 20px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            }}
          >
            {/* J&K Bank Brand Identity */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 14, height: 14, backgroundColor: "#dc2626", borderRadius: 3 }} />
                <div style={{ width: 14, height: 14, backgroundColor: "#2563eb", borderRadius: 3 }} />
                <div style={{ width: 14, height: 14, backgroundColor: "#16a34a", borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", letterSpacing: "0.5px" }}>
                J&amp;K Bank
              </span>
              <span style={{ fontSize: 13, color: "#94a3b8", borderLeft: "1.5px solid #334155", paddingLeft: 8 }}>
                Serving To Empower
              </span>
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 11,
                color: "#10b981",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                marginTop: 4,
              }}
            >
              Official Merchant Partner • Urban Trout
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
              <span style={{ fontSize: 50, fontWeight: 900, color: "#ffffff", letterSpacing: "-1px" }}>
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
              <span style={{ fontSize: 11, fontWeight: 800, color: "#a7f3d0", letterSpacing: "0.5px" }}>
                {numAmount > 0 ? "EXACT AMOUNT LOCKED IN UPI QR" : "DIRECT MERCHANT UPI PAYMENT"}
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
              padding: "24px 20px",
              boxShadow: "0 15px 40px rgba(0,0,0,0.5)",
            }}
          >
            {/* Card Header with Urban Trout Tagline */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                alignItems: "center",
                borderBottom: "1.5px solid #e2e8f0",
                paddingBottom: 12,
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
                  padding: "4px 10px",
                  borderRadius: 8,
                  backgroundColor: "#f1f5f9",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#0369a1",
                }}
              >
                BHIM UPI
              </div>
            </div>

            {/* Vector QR Code with Authentic Center Trout Emblem */}
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

            {/* Supported UPI Apps */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, color: "#334155", letterSpacing: "1.5px" }}>
                SCAN &amp; PAY WITH ANY UPI APP
              </span>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
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
                    backgroundColor: "#15803d",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#ffffff",
                  }}
                >
                  J&amp;K mPay Delight+
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
            <span>Malabagh, Srinagar • 0% Platform Fee</span>
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
    console.error("Error generating J&K Bank QR poster:", err);
    return new Response("Failed to generate J&K Bank QR poster", { status: 500 });
  }
}
