import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

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

    // Default: Fetch the QR image and return raw PNG bytes for Apple Shortcuts Quick Look
    const imgRes = await fetch(qr.image_url);
    if (!imgRes.ok) {
      // Fallback: 302 redirect directly to the image URL
      return NextResponse.redirect(qr.image_url);
    }

    const buffer = await imgRes.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Razorpay-QR-ID": qr.id,
      },
    });
  } catch (err: any) {
    console.error("Error creating Quick Razorpay QR code:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to generate Razorpay QR" },
      { status: 500 }
    );
  }
}
