import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";

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

    // Generate crisp QR code locally with pure JavaScript (0 network calls, 100% reliable)
    const qrDataUri = await QRCode.toDataURL(upiUri, {
      width: 300,
      margin: 1,
      errorCorrectionLevel: "M",
    });

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
            padding: "24px 20px",
            fontFamily: "sans-serif",
          }}
        >
          {/* Top Brand Banner */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 18px",
                borderRadius: "999px",
                backgroundColor: "#ecfdf5",
                border: "1.5px solid #a7f3d0",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 900,
                  color: "#065f46",
                  letterSpacing: "1px",
                }}
              >
                J&amp;K BANK DIRECT MERCHANT UPI
              </span>
            </div>

            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                marginTop: "4px",
              }}
            >
              0% Platform Fee • 100% Direct Account Credit
            </span>
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
              borderRadius: "24px",
              padding: "16px 20px",
              border: "2px solid #e2e8f0",
              boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
            }}
          >
            {/* BHIM / UPI Header inside Card */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                paddingBottom: "10px",
                borderBottom: "1.5px solid #f1f5f9",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 900,
                  color: "#0f766e",
                }}
              >
                BHIM ▶▶
              </span>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 900,
                  color: "#0369a1",
                }}
              >
                UPI ▶▶
              </span>
            </div>

            {/* QR Code */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUri}
              width="270"
              height="270"
              alt="J&K Bank UPI QR Code"
              style={{
                marginTop: "12px",
                borderRadius: "8px",
              }}
            />

            {/* Scan with Any App label */}
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#475569",
                letterSpacing: "1.5px",
                marginTop: "10px",
              }}
            >
              SCAN &amp; PAY WITH ANY UPI APP
            </span>
          </div>

          {/* Supported UPI Apps Row */}
          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <span
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "11px",
                fontWeight: 700,
                color: "#334155",
              }}
            >
              GPay
            </span>
            <span
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "11px",
                fontWeight: 700,
                color: "#6739b7",
              }}
            >
              PhonePe
            </span>
            <span
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "11px",
                fontWeight: 700,
                color: "#00baf2",
              }}
            >
              Paytm
            </span>
            <span
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                backgroundColor: "#059669",
                fontSize: "11px",
                fontWeight: 800,
                color: "#ffffff",
              }}
            >
              J&amp;K mPay
            </span>
          </div>

          {/* Bottom Business Details & Locked Amount */}
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
                fontSize: "24px",
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              Urban Trout Aquaculture
            </span>

            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#64748b",
                marginTop: "2px",
              }}
            >
              Fresh Live RAS Trout Farm • Malabagh
            </span>

            {/* Locked Amount Badge */}
            {numAmount > 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginTop: "8px",
                  padding: "6px 20px",
                  borderRadius: "999px",
                  backgroundColor: "#ecfdf5",
                  border: "2px solid #10b981",
                }}
              >
                <span style={{ fontSize: "14px" }}>🔒</span>
                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: 900,
                    color: "#065f46",
                  }}
                >
                  ₹{numAmount.toLocaleString("en-IN")}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#059669",
                  }}
                >
                  (LOCKED AMOUNT)
                </span>
              </div>
            ) : (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#059669",
                  marginTop: "6px",
                }}
              >
                Direct Merchant UPI Payment
              </span>
            )}

            <span
              style={{
                fontSize: "11px",
                fontFamily: "monospace",
                fontWeight: 700,
                color: "#94a3b8",
                marginTop: "6px",
              }}
            >
              UPI ID: JKBMERC00828895@jkb
            </span>
          </div>
        </div>
      ),
      {
        width: 480,
        height: 780,
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
