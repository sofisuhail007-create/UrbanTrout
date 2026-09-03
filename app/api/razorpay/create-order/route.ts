import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay credentials not configured" }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const body = await req.json();
    const { amount, currency = "INR", receipt, customerName, customerPhone, customerEmail, notes = {} } = body;

    // Validate amount (minimum 100 paise = ₹1)
    if (!amount || typeof amount !== "number" || amount < 100) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum is 100 paise (₹1)." },
        { status: 400 }
      );
    }

    const orderNotes: Record<string, string> = {
      customer_name: String(customerName || notes.customer_name || "Valued Customer").slice(0, 40),
      customer_phone: String(customerPhone || notes.customer_phone || "").slice(0, 15),
      ...notes,
    };
    if (customerEmail) orderNotes.customer_email = String(customerEmail).slice(0, 40);

    const order = await razorpay.orders.create({
      amount, // in paise
      currency,
      receipt: receipt || `ut_${Date.now()}`,
      notes: orderNotes,
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
