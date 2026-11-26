import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import React from "react";
import { cashfreeFetch, extractCashfreeLinkSlug } from "@/lib/cashfree";
import { createShortCashfreeUrl } from "@/lib/payRedirect";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawAmount = searchParams.get("amount") || searchParams.get("am") || "0";
    const riderName = searchParams.get("rider") || "Express Rider";
    const format = searchParams.get("format") || "image";
    const note = searchParams.get("note") || "Live Cashfree Delivery Collection";

    const amountNum = parseFloat(rawAmount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > 50000) {
      return NextResponse.json(
        { success: false, error: "Invalid amount. Pass a positive number between 1 and 50000." },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin || "https://urbantrout.in";
    const linkId = `qqr_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    const res = await cashfreeFetch("/links", {
      method: "POST",
      body: {
        link_id: linkId,
        link_amount: Number(amountNum.toFixed(2)),
        link_currency: "INR",
        link_purpose: `Urban Trout - ₹${Math.round(amountNum)} (${riderName})`.slice(0, 100),
        link_expiry_time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        link_partial_payments: false,
        customer_details: {
          customer_name: "Delivery Customer",
          customer_phone: "919999999999",
        },
        link_notify: { send_sms: false, send_email: false },
        link_meta: {
          upi_intent: true,
          payment_methods: "upi",
          notify_url: `${origin}/api/cashfree/webhook`,
        },
        link_notes: {
          channel: "APPLE_SHORTCUT_QUICK_QR",
          rider: riderName.slice(0, 40),
          note: note.slice(0, 100),
        },
      },
    });

    if (!res.ok || !res.data?.link_url) {
      throw new Error(res.data?.message || "Failed to generate Cashfree QR link");
    }

    const qrDataUri: string = res.data.link_qrcode || "";
    const qrBase64 = qrDataUri.replace(/^data:image\/\w+;base64,/i, "");

    if (format === "raw" && qrBase64) {
      const buf = Buffer.from(qrBase64, "base64");
      return new Response(buf, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Cashfree-QR-ID": res.data.link_id,
        },
      });
    }

    if (format === "json") {
      const slug = extractCashfreeLinkSlug(res.data.link_url);
      const shortPayUrl = slug ? await createShortCashfreeUrl(slug, origin) : res.data.link_url;
      return NextResponse.json({
        success: true,
        qr_id: res.data.link_id,
        image_url: qrDataUri || res.data.link_url,
        pay_url: shortPayUrl,
        short_url: shortPayUrl,
        amount: amountNum,
        rider: riderName,
      });
    }

    const formattedAmount = amountNum.toLocaleString("en-IN", {
      minimumFractionDigits: amountNum % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });

    const fishSvg = React.createElement(
      "svg",
      {
        width: 24,
        height: 24,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#38bdf8",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { marginRight: 8 },
      },
      [
        React.createElement("path", {
          key: "p1",
          d: "M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6-3.56 0-7.56-2.54-8.5-6Z",
        }),
        React.createElement("path", { key: "p2", d: "M18 12v.5" }),
        React.createElement("path", { key: "p3", d: "M16 17.93a9.77 9.77 0 0 1 0-11.86" }),
        React.createElement("path", { key: "p4", d: "M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33" }),
      ]
    );

    const rupeeSvg = React.createElement(
      "svg",
      {
        width: 34,
        height: 34,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#38bdf8",
        strokeWidth: 2.8,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { marginRight: 4, marginTop: 4 },
      },
      [
        React.createElement("path", { key: "r1", d: "M6 3h12" }),
        React.createElement("path", { key: "r2", d: "M6 8h12" }),
        React.createElement("path", { key: "r3", d: "M6 13l8.5 8" }),
        React.createElement("path", { key: "r4", d: "M6 13h3a6 6 0 0 0 0-10" }),
      ]
    );

    return new ImageResponse(
      React.createElement(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#04141d",
            backgroundImage: "radial-gradient(circle at 50% 0%, #0d3b53 0%, #04141d 60%)",
            padding: "28px 36px",
            fontFamily: "sans-serif",
            color: "#ffffff",
          },
        },
        [
          React.createElement(
            "div",
            {
              key: "header",
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "0 10px",
              },
            },
            [
              React.createElement("div", { key: "brand", style: { display: "flex", alignItems: "center" } }, [
                fishSvg,
                React.createElement(
                  "span",
                  { style: { fontSize: 18, fontWeight: 900, letterSpacing: "2px", color: "#38bdf8" } },
                  "URBAN TROUT"
                ),
              ]),
              React.createElement(
                "span",
                {
                  key: "pill",
                  style: {
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#04141d",
                    backgroundColor: "#38bdf8",
                    padding: "4px 12px",
                    borderRadius: "999px",
                  },
                },
                `RIDER: ${riderName.toUpperCase()}`
              ),
            ]
          ),
          React.createElement(
            "div",
            {
              key: "amount-box",
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                margin: "6px 0",
              },
            },
            [
              React.createElement(
                "div",
                { key: "amt-row", style: { display: "flex", alignItems: "center", justifyContent: "center" } },
                [
                  rupeeSvg,
                  React.createElement(
                    "span",
                    { style: { fontSize: 50, fontWeight: 900, color: "#ffffff", letterSpacing: "-1px" } },
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
                    border: "1.5px solid #10b981",
                    borderRadius: "999px",
                    padding: "4px 14px",
                    marginTop: 6,
                  },
                },
                [
                  React.createElement(
                    "span",
                    { style: { fontSize: 11, fontWeight: 800, color: "#a7f3d0", letterSpacing: "0.5px" } },
                    "CASHFREE SECURE CHECKOUT QR"
                  ),
                ]
              ),
            ]
          ),
          React.createElement(
            "div",
            {
              key: "qr-frame",
              style: {
                display: "flex",
                flexDirection: "column",
                width: 460,
                height: 460,
                borderRadius: "24px",
                border: "3px solid rgba(56, 189, 248, 0.5)",
                backgroundColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
              },
            },
            [
              qrDataUri
                ? React.createElement("img", {
                    src: qrDataUri,
                    width: 400,
                    height: 400,
                    style: { objectFit: "contain" },
                  })
                : React.createElement(
                    "span",
                    { style: { color: "#0f172a", fontSize: 16, fontWeight: 700 } },
                    res.data.link_url
                  ),
            ]
          ),
          React.createElement(
            "div",
            {
              key: "footer",
              style: {
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                padding: "0 8px",
                fontSize: 12,
                color: "#94a3b8",
                fontWeight: 600,
              },
            },
            [
              React.createElement("span", null, "Malabagh, Srinagar • Cashfree Secured"),
              React.createElement("span", null, "UPI • GPay • PhonePe • Paytm"),
            ]
          ),
        ]
      ),
      {
        width: 720,
        height: 1280,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Cashfree-QR-ID": res.data.link_id,
        },
      }
    );
  } catch (err: any) {
    console.error("Error creating Quick Cashfree QR:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to generate Cashfree QR" },
      { status: 500 }
    );
  }
}
