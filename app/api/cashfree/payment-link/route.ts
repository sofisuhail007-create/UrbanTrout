import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/adminAuth";
import {
  cancelCashfreePaymentLink,
  cashfreeFetch,
  extractCashfreeLinkSlug,
  normalizeIndianPhone,
  resolveCashfreeLinkPayment,
} from "@/lib/cashfree";
import { createShortCashfreeUrl } from "@/lib/payRedirect";

export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      amount,
      description,
      customerName = "Valued Customer",
      customerPhone = "",
      customerEmail = "",
      orderRef = "",
      invoiceId = "",
      expiryHours = 168,
      notes = {},
    } = body;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 1) {
      return NextResponse.json({ success: false, error: "Amount must be at least ₹1" }, { status: 400 });
    }

    const cleanPhone = normalizeIndianPhone(customerPhone);
    const hasRealPhone = String(customerPhone || "").replace(/\D/g, "").length >= 10;
    const rawRef = String(orderRef || invoiceId || `UT-${Date.now().toString().slice(-6)}`).trim();
    const safeLinkId = `link_${rawRef.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString().slice(-4)}`.slice(0, 48);
    const expiryDate = new Date(Date.now() + Math.max(1, Number(expiryHours) || 168) * 3600 * 1000).toISOString();
    const origin = new URL(request.url).origin || "https://urbantrout.in";

    const linkPayload = {
      link_id: safeLinkId,
      link_amount: Number(numAmount.toFixed(2)),
      link_currency: "INR",
      link_purpose: String(description || `Urban Trout Order #${rawRef}`).slice(0, 100),
      link_expiry_time: expiryDate,
      link_partial_payments: false,
      customer_details: {
        customer_name: String(customerName || "Valued Customer").trim().slice(0, 45),
        customer_phone: hasRealPhone ? `91${cleanPhone}` : "919999999999",
        ...(customerEmail ? { customer_email: String(customerEmail).trim().slice(0, 60) } : {}),
      },
      link_notify: {
        send_sms: false,
        send_email: false,
      },
      link_meta: {
        upi_intent: true,
        notify_url: `${origin}/api/cashfree/webhook`,
        ...(invoiceId ? { return_url: `${origin}/invoice/${encodeURIComponent(invoiceId)}` } : {}),
      },
      link_notes: {
        order_ref: rawRef,
        invoice_id: String(invoiceId || ""),
        customer_name: String(customerName || "Customer").slice(0, 45),
        ...(hasRealPhone ? { customer_phone: cleanPhone } : {}),
        ...(typeof notes === "object" && notes ? notes : {}),
      },
    };

    const res = await cashfreeFetch("/links", { method: "POST", body: linkPayload });
    if (!res.ok || !res.data?.link_url) {
      console.error("Cashfree payment-link error:", res.status, res.data);
      return NextResponse.json(
        { success: false, error: res.data?.message || "Failed to create Cashfree payment link" },
        { status: res.status >= 400 ? res.status : 500 }
      );
    }

    const slug = extractCashfreeLinkSlug(res.data.link_url);
    const brandedUrl = slug ? await createShortCashfreeUrl(slug) : res.data.link_url;

    return NextResponse.json({
      success: true,
      id: res.data.link_id,
      cf_link_id: res.data.cf_link_id,
      short_url: res.data.link_url,
      branded_url: brandedUrl,
      link_qrcode: res.data.link_qrcode || null,
      status: res.data.link_status || "ACTIVE",
      amount: res.data.link_amount || numAmount,
    });
  } catch (err: any) {
    console.error("Cashfree payment-link POST error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to create Cashfree link" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("link_id") || "";
    if (!linkId) {
      return NextResponse.json({ success: false, error: "Missing link_id parameter" }, { status: 400 });
    }

    const resolved = await resolveCashfreeLinkPayment(linkId);
    const statusLower = String(resolved.linkData?.link_status || "ACTIVE").toLowerCase();

    return NextResponse.json({
      success: true,
      link_id: linkId,
      status: resolved.isPaid ? "paid" : statusLower,
      paid: resolved.isPaid,
      cancelled: resolved.isCancelled,
      expired: resolved.isExpired,
      amount_paid: resolved.paidAmount,
      payment: resolved.payment,
    });
  } catch (err: any) {
    console.error("Cashfree payment-link GET error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch Cashfree link status" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("link_id") || "";
    if (!linkId) {
      return NextResponse.json({ success: false, error: "Missing link_id parameter" }, { status: 400 });
    }

    const res = await cancelCashfreePaymentLink(linkId);
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: res.data?.message || "Failed to cancel Cashfree link" },
        { status: res.status >= 400 ? res.status : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      link_id: linkId,
      status: res.data?.link_status || "CANCELLED",
    });
  } catch (err: any) {
    console.error("Cashfree payment-link DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to cancel Cashfree link" },
      { status: 500 }
    );
  }
}
