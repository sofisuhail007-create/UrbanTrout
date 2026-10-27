import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import Razorpay from "razorpay";
import React from "react";

export const dynamic = "force-dynamic";

function getRazorpayClient() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured in environment.");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * GET /api/razorpay/quick-qr?amount=200&rider=Suhail
 * Generates an instant, single-use Razorpay UPI QR code locked to the specified amount
 * and returns it directly as an image (PNG) for Apple Shortcuts Quick Look.
 * When paid, Razorpay webhook automatically sends an instant Telegram notification!
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const amountStr = searchParams.get("amount") || searchParams.get("am");
    const rider = searchParams.get("rider") || "Suhail (Bike Delivery)";
    const format = searchParams.get("format"); // "json" | "image" (default)

    const numAmount = parseFloat(amountStr || "0");
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount. Must be greater than ₹0." },
        { status: 400 }
      );
    }

    const amountInPaise = Math.round(numAmount * 100);
    if (amountInPaise < 100) {
      return NextResponse.json(
        { success: false, error: "Amount must be at least ₹1." },
        { status: 400 }
      );
    }

    const razorpay = getRazorpayClient();
    const desc = "Fresh Rainbow Trout";

    const qr = await razorpay.qrCode.create({
      type: "upi_qr",
      name: "Urban Trout Aquaculture",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: amountInPaise,
      description: desc,
      notes: {
        channel: "RIDER_COD_QR",
        customer_name: "Doorstep COD Customer",
        rider: rider.slice(0, 30),
      },
    });

    // If caller explicitly requested JSON metadata
    if (format === "json") {
      return NextResponse.json({
        success: true,
        qr_id: qr.id,
        image_url: qr.image_url,
        amount: numAmount,
      });
    }

    // Raw format: Fetch the unbranded QR image and return raw PNG bytes directly
    if (format === "raw") {
      const imgRes = await fetch(qr.image_url);
      if (!imgRes.ok) return NextResponse.redirect(qr.image_url);
      const buffer = await imgRes.arrayBuffer();
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Razorpay-QR-ID": qr.id,
        },
      });
    }

    // Default: Fetch the Razorpay QR code and composite an ultra-clear, branded payment card
    // with the exact locked amount prominently displayed above the QR for Apple Shortcuts Quick Look
    const imgRes = await fetch(qr.image_url);
    if (!imgRes.ok) {
      return NextResponse.redirect(qr.image_url);
    }

    const rzpBuffer = await imgRes.arrayBuffer();
    const rzpBase64 = Buffer.from(rzpBuffer).toString("base64");
    const rzpDataUri = `data:image/png;base64,${rzpBase64}`;

    const formattedAmount = Number(numAmount).toLocaleString("en-IN", {
      minimumFractionDigits: Number.isInteger(numAmount) ? 0 : 2,
      maximumFractionDigits: 2,
    });

    const rupeeSvg = React.createElement(
      "svg",
      {
        width: 44,
        height: 50,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#38bdf8",
        strokeWidth: 2.5,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { marginRight: 4, display: "flex" },
      },
      [
        React.createElement("path", {
          d: "M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4.5 4.5 0 0 0 0-9H6",
        }),
      ]
    );

    return new ImageResponse(
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            width: 674,
            height: 1880,
            backgroundColor: "#020d12",
            alignItems: "center",
            padding: "16px 14px",
          },
        },
        [
          // Top Header Banner with Locked Amount
          React.createElement(
            "div",
            {
              key: "header",
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#061a24",
                border: "2px solid #38bdf8",
                borderRadius: "22px",
                padding: "16px 20px",
                marginBottom: "14px",
                width: "100%",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              },
            },
            [
              React.createElement(
                "div",
                {
                  key: "subtitle",
                  style: {
                    display: "flex",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    marginBottom: "4px",
                  },
                },
                "Urban Trout Aquaculture • Doorstep COD"
              ),
              React.createElement(
                "div",
                {
                  key: "amt-row",
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "2px",
                  },
                },
                [
                  rupeeSvg,
                  React.createElement(
                    "span",
                    {
                      style: {
                        fontSize: 62,
                        fontWeight: 900,
                        color: "#ffffff",
                        letterSpacing: "-1px",
                      },
                    },
                    formattedAmount
                  ),
                ]
              ),
              React.createElement(
                "div",
                {
                  key: "badge",
                  style: {
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#064e3b",
                    border: "1px solid #10b981",
                    borderRadius: "999px",
                    padding: "4px 14px",
                    marginTop: "6px",
                  },
                },
                [
                  React.createElement(
                    "span",
                    {
                      style: {
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#a7f3d0",
                      },
                    },
                    "EXACT AMOUNT LOCKED IN QR"
                  ),
                ]
              ),
              React.createElement(
                "div",
                {
                  key: "subtext",
                  style: {
                    display: "flex",
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: "6px",
                  },
                },
                "Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)"
              ),
            ]
          ),
          // Razorpay Official QR Code Image
          React.createElement("img", {
            key: "rzp-card",
            src: rzpDataUri,
            width: 646,
            height: 1575,
            style: { borderRadius: "18px" },
          }),
        ]
      ),
      {
        width: 674,
        height: 1880,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Razorpay-QR-ID": qr.id,
        },
      }
    );
  } catch (err: any) {
    console.error("Error creating Quick Razorpay QR code:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to generate Razorpay QR" },
      { status: 500 }
    );
  }
}
