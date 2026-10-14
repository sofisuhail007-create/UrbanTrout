import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

/**
 * GET /api/jk-qr?amount=200
 * Generates an executive, branded J&K Bank merchant standee poster (PNG)
 * with the exact locked amount, BHIM UPI branding, supported app badges,
 * and high-contrast QR code for instant iOS Shortcuts Quick Look.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const amountStr = searchParams.get("amount") || searchParams.get("am") || "0";
    const numAmount = parseFloat(amountStr) || 0;

    const upiId = "JKBMERC00828895@jkb";
    const upiUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Aquaculture&am=${numAmount > 0 ? numAmount.toFixed(2) : "0"}&cu=INR&tn=Urban%20Trout%20Fresh%20Fish`;

    // Fetch crisp QR code from qrserver
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}&bgcolor=255-255-255&color=0-0-0&margin=1`;
    const imgRes = await fetch(qrUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const qrBase64 = Buffer.from(imgBuffer).toString("base64");
    const qrDataUri = `data:image/png;base64,${qrBase64}`;

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            backgroundColor: "#ffffff",
            padding: "26px 22px",
            fontFamily: "sans-serif",
            position: "relative",
          }}
        >
          {/* Top Brand Banner */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: "4px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 18px",
                borderRadius: "999px",
                backgroundColor: "#ecfdf5",
                border: "1.5px solid #a7f3d0",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "5px",
                  backgroundColor: "#059669",
                }}
              />
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#065f46",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                J&amp;K Bank Direct Merchant UPI
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "6px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
              }}
            >
              <span>0% Platform Fee</span>
              <span>•</span>
              <span>Instant Bank Credit</span>
            </div>
          </div>

          {/* Center Card (Elevated Standee Poster) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "#ffffff",
              borderRadius: "28px",
              padding: "20px 24px",
              border: "2px solid #e2e8f0",
              boxShadow: "0 16px 36px -4px rgba(15, 23, 42, 0.12)",
            }}
          >
            {/* BHIM / UPI Header inside Card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                paddingBottom: "12px",
                borderBottom: "1.5px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "16px",
                  fontWeight: 900,
                  color: "#0f766e",
                  letterSpacing: "0.5px",
                }}
              >
                <span>BHIM</span>
                <span style={{ color: "#ea580c" }}>▶▶</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "16px",
                  fontWeight: 900,
                  color: "#0369a1",
                  letterSpacing: "0.5px",
                }}
              >
                <span>UPI</span>
                <span style={{ color: "#059669" }}>▶▶</span>
              </div>
            </div>

            {/* QR Code */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "16px",
                padding: "6px",
                borderRadius: "16px",
                backgroundColor: "#ffffff",
              }}
            >
              <img
                src={qrDataUri}
                width="280"
                height="280"
                style={{
                  borderRadius: "12px",
                }}
              />
            </div>

            {/* Scan with Any App label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "12px",
                fontSize: "11px",
                fontWeight: 800,
                color: "#475569",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
              }}
            >
              Scan &amp; Pay With Any UPI App
            </div>
          </div>

          {/* Supported UPI Apps Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "10px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                fontSize: "11px",
                fontWeight: 700,
                color: "#1e293b",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              GPay
            </div>
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "10px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                fontSize: "11px",
                fontWeight: 700,
                color: "#6739b7",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              PhonePe
            </div>
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "10px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                fontSize: "11px",
                fontWeight: 700,
                color: "#00baf2",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              Paytm
            </div>
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "10px",
                backgroundColor: "#059669",
                fontSize: "11px",
                fontWeight: 800,
                color: "#ffffff",
                boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
              }}
            >
              mPay
            </div>
          </div>

          {/* Bottom Business Details & Locked Amount */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                fontSize: "24px",
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: "-0.5px",
                textAlign: "center",
              }}
            >
              Urban Trout Aquaculture
            </div>

            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#64748b",
                marginTop: "2px",
              }}
            >
              Fresh Live RAS Trout Farm • Malabagh
            </div>

            {/* Locked Amount Badge */}
            {numAmount > 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "10px",
                  padding: "8px 24px",
                  borderRadius: "999px",
                  backgroundColor: "#ecfdf5",
                  border: "2px solid #10b981",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.15)",
                }}
              >
                <span style={{ fontSize: "15px" }}>🔒</span>
                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: 900,
                    color: "#065f46",
                    letterSpacing: "-0.5px",
                  }}
                >
                  ₹{numAmount.toLocaleString("en-IN")}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#059669",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  (Locked Amount)
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginTop: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#059669",
                }}
              >
                <span>Direct Merchant UPI Payment</span>
              </div>
            )}

            <div
              style={{
                fontSize: "11px",
                fontFamily: "monospace",
                fontWeight: 700,
                color: "#94a3b8",
                marginTop: "8px",
              }}
            >
              UPI ID: JKBMERC00828895@jkb
            </div>
          </div>
        </div>
      ),
      {
        width: 500,
        height: 940,
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
