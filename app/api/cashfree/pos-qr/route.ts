import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/adminAuth";
import {
  cancelCashfreePaymentLink,
  cashfreeFetch,
  getCashfreeOrderPayments,
  normalizeIndianPhone,
  resolveCashfreeLinkPayment,
} from "@/lib/cashfree";

export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      amount,
      description,
      customerName = "Counter Customer",
      customerPhone = "",
      orderRef = "",
    } = body;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 1) {
      return NextResponse.json({ success: false, error: "Invalid QR amount" }, { status: 400 });
    }

    const cleanPhone = normalizeIndianPhone(customerPhone);
    const hasRealPhone = String(customerPhone || "").replace(/\D/g, "").length >= 10;
    const rawRef = String(orderRef || `POS_${Date.now().toString().slice(-6)}`).trim();
    const origin = new URL(request.url).origin || "https://urbantrout.in";

    // Optional S2S Seamless Dynamic UPI QR (only if enabled on merchant Cashfree account)
    if (process.env.CASHFREE_S2S_QR_ENABLED === "true") {
      try {
        const orderId = `UTPOS_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
        const orderRes = await cashfreeFetch("/orders", {
          method: "POST",
          body: {
            order_id: orderId,
            order_amount: Number(numAmount.toFixed(2)),
            order_currency: "INR",
            customer_details: {
              customer_id: `cust_${cleanPhone}`,
              customer_name: String(customerName || "Counter Customer").slice(0, 40),
              customer_phone: cleanPhone,
            },
            order_meta: {
              notify_url: `${origin}/api/cashfree/webhook`,
            },
            order_note: String(description || `Counter POS #${rawRef}`).slice(0, 120),
          },
        });

        if (orderRes.ok && orderRes.data?.payment_session_id) {
          const qrRes = await cashfreeFetch("/orders/sessions", {
            method: "POST",
            body: {
              payment_session_id: orderRes.data.payment_session_id,
              payment_method: { upi: { channel: "qrcode" } },
            },
          });
          const qrPayload = qrRes.data?.data?.payload?.qrcode;
          if (qrRes.ok && qrPayload) {
            return NextResponse.json({
              success: true,
              qr_id: orderId,
              image_url: qrPayload,
              short_url: null,
              amount: numAmount,
              mode: "s2s_upi_qr",
            });
          }
        }
      } catch (_) {
        // Fall through cleanly to Cashfree Payment Link QR
      }
    }

    // Standard Cashfree Payment Link with UPI Intent & QR Code (guaranteed out of the box)
    const safeLinkId = `pos_${rawRef.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString().slice(-5)}`.slice(0, 48);
    const expiryIso = new Date(Date.now() + 4 * 3600 * 1000).toISOString();

    const linkRes = await cashfreeFetch("/links", {
      method: "POST",
      body: {
        link_id: safeLinkId,
        link_amount: Number(numAmount.toFixed(2)),
        link_currency: "INR",
        link_purpose: String(description || `Urban Trout POS #${rawRef}`).slice(0, 100),
        link_expiry_time: expiryIso,
        link_partial_payments: false,
        customer_details: {
          customer_name: String(customerName || "Counter Customer").slice(0, 45),
          customer_phone: hasRealPhone ? `91${cleanPhone}` : "919999999999",
        },
        link_notify: { send_sms: false, send_email: false },
        link_meta: {
          upi_intent: true,
          payment_methods: "upi",
          notify_url: `${origin}/api/cashfree/webhook`,
        },
        link_notes: {
          channel: "COUNTER_POS_QR",
          order_ref: rawRef,
          customer_name: String(customerName || "Counter Customer").slice(0, 45),
          ...(hasRealPhone ? { customer_phone: cleanPhone } : {}),
        },
      },
    });

    if (!linkRes.ok || !linkRes.data?.link_url) {
      return NextResponse.json(
        { success: false, error: linkRes.data?.message || "Failed to generate Cashfree POS QR" },
        { status: linkRes.status >= 400 ? linkRes.status : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      qr_id: linkRes.data.link_id,
      image_url: linkRes.data.link_qrcode || linkRes.data.link_url,
      short_url: linkRes.data.link_url,
      amount: numAmount,
      mode: "cashfree_link_qr",
    });
  } catch (err: any) {
    console.error("Cashfree POS QR POST error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to generate Cashfree QR" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const qrId = searchParams.get("qr_id") || "";
    if (!qrId) {
      return NextResponse.json({ success: false, error: "Missing qr_id parameter" }, { status: 400 });
    }

    // If S2S order-based QR id (starts with UTPOS_ or UT_)
    if (/^(?:UTPOS_|UT_)/i.test(qrId)) {
      const payRes = await getCashfreeOrderPayments(qrId);
      const list = Array.isArray(payRes.data) ? payRes.data : [];
      const successPay = list.find((p) => String(p.payment_status || "").toUpperCase() === "SUCCESS");

      return NextResponse.json({
        success: true,
        qr_id: qrId,
        paid: Boolean(successPay),
        cancelled: false,
        status: successPay ? "paid" : "active",
        amount_received: successPay?.payment_amount || 0,
        payment: successPay
          ? {
              id: String(successPay.cf_payment_id || qrId),
              amount: Number(successPay.payment_amount || 0),
              method: successPay.payment_group || "upi",
              vpa: successPay.payment_method?.upi?.upi_id || null,
              bank_reference: successPay.bank_reference || null,
              created_at: successPay.payment_completion_time || successPay.payment_time || new Date().toISOString(),
            }
          : null,
      });
    }

    // Standard Cashfree link-based QR id
    const resolved = await resolveCashfreeLinkPayment(qrId);
    const statusLower = String(resolved.linkData?.link_status || "ACTIVE").toLowerCase();

    return NextResponse.json({
      success: true,
      qr_id: qrId,
      paid: resolved.isPaid,
      cancelled: resolved.isCancelled,
      status: resolved.isPaid ? "paid" : statusLower,
      amount_received: resolved.paidAmount,
      payment: resolved.payment
        ? {
            id: resolved.payment.id,
            amount: resolved.payment.amount,
            method: resolved.payment.method,
            vpa: resolved.payment.vpa,
            bank_reference: resolved.payment.bank_reference,
            created_at: resolved.payment.captured_at,
          }
        : null,
    });
  } catch (err: any) {
    console.error("Cashfree POS QR GET error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to poll Cashfree QR status" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const qrId = searchParams.get("qr_id") || "";
    if (!qrId) {
      return NextResponse.json({ success: false, error: "Missing qr_id parameter" }, { status: 400 });
    }

    if (!/^(?:UTPOS_|UT_)/i.test(qrId)) {
      await cancelCashfreePaymentLink(qrId);
    }

    return NextResponse.json({ success: true, qr_id: qrId, closed: true });
  } catch (err: any) {
    console.error("Cashfree POS QR DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to cancel Cashfree QR" },
      { status: 500 }
    );
  }
}
