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
 * POST /api/razorpay/pos-qr
 * Creates a dynamic, single-use Razorpay UPI QR code locked to the exact amount.
 */
export async function POST(req: NextRequest) {
  try {
    const razorpay = getRazorpayClient();
    const body = await req.json();
    const { amount, customerName, customerPhone, billNumber } = body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount. Must be greater than ₹0." },
        { status: 400 }
      );
    }

    // Amount in paise (minimum 100 paise = ₹1)
    const amountInPaise = Math.round(numAmount * 100);
    if (amountInPaise < 100) {
      return NextResponse.json(
        { success: false, error: "Amount must be at least ₹1." },
        { status: 400 }
      );
    }

    const desc = billNumber
      ? "POS Invoice #" + String(billNumber)
      : "Urban Trout POS - Rs." + String(numAmount);

    const qr = await razorpay.qrCode.create({
      type: "upi_qr",
      name: "Urban Trout Aquaculture",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: amountInPaise,
      description: desc.slice(0, 30), // Razorpay limit
      notes: {
        channel: "POS_BILLING",
        customer_name: (customerName || "Walk-in Customer").slice(0, 40),
        customer_phone: (customerPhone || "N/A").slice(0, 15),
      },
    });

    return NextResponse.json({
      success: true,
      qr_id: qr.id,
      image_url: qr.image_url,
      amount: numAmount,
      created_at: qr.created_at,
    });
  } catch (err: any) {
    console.error("Error creating POS Razorpay QR code:", err);
    const message =
      err?.error?.description || err?.message || "Failed to create Razorpay QR code";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/razorpay/pos-qr?qr_id=qr_xxx
 * Polls payment status for a specific dynamic QR code.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qrId = searchParams.get("qr_id");

    if (!qrId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'qr_id'" },
        { status: 400 }
      );
    }

    const razorpay = getRazorpayClient();
    const payments = await razorpay.qrCode.fetchAllPayments(qrId);

    const items = (payments as any)?.items || [];
    // Find captured payment
    const captured = items.find((p: any) => p.status === "captured");

    if (captured) {
      return NextResponse.json({
        success: true,
        paid: true,
        payment: {
          id: captured.id,
          order_id: captured.order_id,
          amount: captured.amount / 100,
          currency: captured.currency,
          status: captured.status,
          method: captured.method,
          vpa: captured.vpa || null,
          created_at: captured.created_at,
          contact: captured.contact || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      paid: false,
    });
  } catch (err: any) {
    console.error("Error fetching POS Razorpay QR payments:", err);
    const message =
      err?.error?.description || err?.message || "Failed to fetch payment status";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/razorpay/pos-qr?qr_id=qr_xxx
 * Closes an active dynamic QR code when no longer needed.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qrId = searchParams.get("qr_id");

    if (!qrId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'qr_id'" },
        { status: 400 }
      );
    }

    const razorpay = getRazorpayClient();
    try {
      await razorpay.qrCode.close(qrId);
    } catch (closeErr: any) {
      // If already closed or not found, ignore
      console.warn("QR code close notice:", closeErr?.message || closeErr);
    }

    return NextResponse.json({ success: true, message: "QR code closed" });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to close QR code" },
      { status: 500 }
    );
  }
}
