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
 * POST /api/razorpay/payment-link
 * Creates an official single-use Razorpay Payment Link for WhatsApp sharing.
 */
export async function POST(req: NextRequest) {
  try {
    const razorpay = getRazorpayClient();
    const body = await req.json();
    const {
      amount,
      customerName,
      customerPhone,
      customerEmail,
      orderRef,
      itemsSummary,
      notes,
    } = body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount. Must be greater than ₹0." },
        { status: 400 }
      );
    }

    const amountInPaise = Math.round(numAmount * 100);
    const cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
    const cleanName = (customerName || "Valued Customer").trim();
    const ref = orderRef || `UT-DEL-${Date.now().toString().slice(-6)}`;

    const desc = `Fresh Trout (Inv #${ref})`.slice(0, 30);

    const origin = req.nextUrl?.origin || "https://urbantrout.in";

    // Create official single-use locked payment link
    const paymentLink = await razorpay.paymentLink.create({
      amount: amountInPaise,
      currency: "INR",
      accept_partial: false,
      description: desc,
      customer: {
        name: cleanName,
        contact: cleanPhone ? `+91${cleanPhone}` : undefined,
        email: customerEmail || undefined,
      },
      notify: {
        sms: false,
        email: false,
        whatsapp: false, // We dispatch our own branded WhatsApp message with the exact link!
      },
      reminder_enable: true,
      notes: {
        channel: "HOME_DELIVERY",
        customer_name: cleanName,
        customer_phone: cleanPhone || "N/A",
        customer_email: customerEmail || "N/A",
        order_ref: ref,
        items_summary: itemsSummary || "Fresh Rainbow Trout",
        custom_notes: notes || "",
      },
      callback_url: `${origin}/invoice/${ref}`,
      callback_method: "get",
    });

    return NextResponse.json({
      success: true,
      paymentLink: {
        id: paymentLink.id,
        short_url: paymentLink.short_url,
        amount: numAmount,
        currency: paymentLink.currency,
        status: paymentLink.status,
        orderRef: ref,
        customerName: cleanName,
        customerPhone: cleanPhone,
        itemsSummary,
        created_at: paymentLink.created_at,
      },
    });
  } catch (err: any) {
    console.error("Error creating Razorpay Payment Link:", err);
    const message =
      err?.error?.description || err?.message || "Failed to create Razorpay Payment Link";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/razorpay/payment-link?link_id=plink_xxx
 * Polls the real-time status of a payment link directly from Razorpay.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get("link_id");

    if (!linkId) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameter: 'link_id'" },
        { status: 400 }
      );
    }

    const razorpay = getRazorpayClient();
    const pl = await razorpay.paymentLink.fetch(linkId);

    const isPaid = pl.status === "paid";
    const amountPaid = Number(pl.amount_paid || pl.amount || 0) / 100;

    return NextResponse.json({
      success: true,
      paid: isPaid,
      status: pl.status,
      payment: isPaid
        ? {
            id: pl.id,
            amount: amountPaid,
            status: pl.status,
            customer: pl.customer,
            notes: pl.notes,
          }
        : null,
    });
  } catch (err: any) {
    console.error("Error fetching payment link status:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch payment link" },
      { status: 500 }
    );
  }
}
