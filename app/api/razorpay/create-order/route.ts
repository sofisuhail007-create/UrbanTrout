import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Razorpay credentials not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { amount, currency = "INR", receipt } = body;

    // Validate amount (minimum 100 paise = ₹1)
    if (!amount || typeof amount !== "number" || amount < 100) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum is 100 paise (₹1)." },
        { status: 400 }
      );
    }

    const order = await razorpay.orders.create({
      amount, // in paise
      currency,
      receipt: receipt || `ut_${Date.now()}`,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err: unknown) {
    console.error("Razorpay create-order error:", err);
    const message =
      err && typeof err === "object" && "error" in err
        ? (err as { error: { description?: string } }).error?.description
        : "Failed to create Razorpay order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
