import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/jk-qr?amount=200
 * Generates an instant, zero-fee J&K Bank locked UPI QR code image (PNG)
 * so iOS Shortcuts can download and display it full-screen via Quick Look
 * directly from Lock Screen and Home Screen widgets!
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const amountStr = searchParams.get("amount") || searchParams.get("am") || "0";
    const numAmount = parseFloat(amountStr) || 0;

    const upiId = "JKBMERC00828895@jkb";
    const upiUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Aquaculture&am=${numAmount > 0 ? numAmount.toFixed(2) : "0"}&cu=INR&tn=Urban%20Trout%20Fresh%20Fish`;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(upiUri)}&bgcolor=255-255-255&color=0-0-0&margin=2`;

    const imgRes = await fetch(qrUrl);
    if (!imgRes.ok) {
      return NextResponse.redirect(qrUrl);
    }

    const buffer = await imgRes.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error("Error generating J&K Bank QR image:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to generate J&K Bank QR" },
      { status: 500 }
    );
  }
}
