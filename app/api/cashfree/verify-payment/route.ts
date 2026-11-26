import { NextResponse } from "next/server";
import { getCashfreeOrder, getCashfreeOrderPayments } from "@/lib/cashfree";

async function verifyOrder(orderId: string) {
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json(
      { verified: false, error: "Missing Cashfree order_id" },
      { status: 400 }
    );
  }

  const [orderRes, paymentsRes] = await Promise.all([
    getCashfreeOrder(orderId),
    getCashfreeOrderPayments(orderId),
  ]);

  if (!orderRes.ok) {
    return NextResponse.json(
      { verified: false, error: orderRes.data?.message || "Cashfree order lookup failed" },
      { status: orderRes.status >= 400 ? orderRes.status : 500 }
    );
  }

  const orderStatus = String(orderRes.data?.order_status || "").toUpperCase();
  const payments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
  const successPayment = payments.find(
    (p) => String(p.payment_status || "").toUpperCase() === "SUCCESS"
  );

  const isVerified = orderStatus === "PAID" || Boolean(successPayment);

  if (!isVerified) {
    return NextResponse.json(
      {
        verified: false,
        order_status: orderStatus || "PENDING",
        error: "Payment not completed on Cashfree",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    verified: true,
    order_id: orderRes.data.order_id,
    cf_order_id: orderRes.data.cf_order_id,
    cf_payment_id: successPayment?.cf_payment_id ? String(successPayment.cf_payment_id) : orderId,
    payment_amount: successPayment?.payment_amount || orderRes.data.order_amount,
    payment_group: successPayment?.payment_group || "upi",
    vpa: successPayment?.payment_method?.upi?.upi_id || null,
    bank_reference: successPayment?.bank_reference || null,
    order_status: orderStatus,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = body.order_id || body.cashfree_order_id || "";
    return await verifyOrder(String(orderId).trim());
  } catch (err: any) {
    console.error("Cashfree verify-payment POST error:", err);
    return NextResponse.json(
      { verified: false, error: err?.message || "Failed to verify Cashfree payment" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id") || "";
    return await verifyOrder(orderId.trim());
  } catch (err: any) {
    console.error("Cashfree verify-payment GET error:", err);
    return NextResponse.json(
      { verified: false, error: err?.message || "Failed to verify Cashfree payment" },
      { status: 500 }
    );
  }
}
