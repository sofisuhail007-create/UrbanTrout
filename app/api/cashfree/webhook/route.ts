import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyCashfreePayment } from "@/lib/telegram";
import { sendPaymentLinkConfirmationEmail } from "@/lib/email";
import { enqueueWhatsAppDispatch } from "@/lib/whatsappDispatch";
import { autoSettleKhataPayment } from "@/lib/khataAutoSettle";
import { logOrderToVendingSales } from "@/lib/aquariumStock";
import {
  getCashfreeCredentials,
  getCashfreeOrder,
  getCashfreePaymentLink,
  verifyCashfreeWebhookSignature,
} from "@/lib/cashfree";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const processedPaymentsInMemory = new Map<string, number>();

async function acquirePaymentLock(paymentId: string): Promise<boolean> {
  const cleanId = (paymentId || "").trim();
  if (!cleanId) return true;

  const now = Date.now();
  const memTs = processedPaymentsInMemory.get(cleanId);
  if (memTs && now - memTs < 2 * 60 * 60 * 1000) return false;

  try {
    const dbKey = `pay_lock_${cleanId}`;
    const { data: existing } = await supabase
      .from("app_settings")
      .select("key, updated_at")
      .eq("key", dbKey)
      .maybeSingle();

    if (existing) {
      const ts = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
      if (now - ts < 2 * 60 * 60 * 1000) {
        processedPaymentsInMemory.set(cleanId, now);
        return false;
      }
    }

    const { error } = await supabase.from("app_settings").insert({
      key: dbKey,
      value: JSON.stringify({ ts: now, paymentId: cleanId, gateway: "cashfree" }),
      description: "Atomic Cashfree Webhook Idempotency Lock",
      updated_at: new Date().toISOString(),
    });

    if (error && (error.code === "23505" || error.message?.toLowerCase().includes("duplicate"))) {
      processedPaymentsInMemory.set(cleanId, now);
      return false;
    }

    processedPaymentsInMemory.set(cleanId, now);
    return true;
  } catch {
    processedPaymentsInMemory.set(cleanId, now);
    return true;
  }
}

async function autoPoolOrderToSupabase(params: {
  orderRef: string;
  paymentId: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  locality?: string;
  address?: string;
  pincode?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  googleMapsUrl?: string | null;
  deliveryZone?: string;
  deliveryFee?: number;
  items?: Array<{ id?: string; name: string; quantity: number; unit?: string; price: number }>;
  itemsSummary?: string;
  isScheduled?: boolean;
  scheduledDate?: string | null;
  scheduledSlot?: string | null;
  channel?: string;
}) {
  try {
    const cleanPhone = String(params.customerPhone || "").replace(/\D/g, "").slice(-10);
    if (!cleanPhone && !params.paymentId) return;

    const { data: existingByPay } = await supabase
      .from("orders")
      .select("id, order_number")
      .like("customer_address", `%${params.paymentId}%`)
      .maybeSingle();

    if (existingByPay) {
      return existingByPay;
    }

    let items = params.items;
    if (!Array.isArray(items) || items.length === 0) {
      const desc = params.itemsSummary || "Cleaned & Gutted Trout";
      const weightMatch = desc.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
      const isWhole = /\b(?:whole|sabut)\b/i.test(desc);
      const weightKg = weightMatch ? parseFloat(weightMatch[1]) : Math.max(1, Math.round((params.amount || 580) / 580));
      const rate = isWhole ? 540 : 580;
      items = [
        {
          id: isWhole ? "whole-trout" : "gutted-trout",
          name: isWhole ? "Whole Fresh Trout" : "Cleaned & Gutted Trout",
          quantity: weightKg,
          unit: "Kg",
          price: rate,
        },
      ];
    }

    const deliveryFee = Number(params.deliveryFee || 0);
    const subtotal = Math.max(0, Number(params.amount || 0) - deliveryFee);

    let addressParts: string[] = [];
    if (params.address) addressParts.push(params.address);
    else if (params.locality) addressParts.push(params.locality);
    else addressParts.push("Srinagar");

    addressParts.push(`(Ref: #${params.orderRef}, Cashfree: ${params.paymentId})`);
    if (params.isScheduled && params.scheduledSlot) {
      addressParts.push(`[SCHEDULED DELIVERY: ${params.scheduledDate || "Advance"} | Slot: ${params.scheduledSlot}]`);
    }
    if (params.googleMapsUrl) {
      addressParts.push(`Exact GPS: ${params.googleMapsUrl}`);
    } else if (params.latitude && params.longitude) {
      addressParts.push(`Exact GPS: https://www.google.com/maps/dir/?api=1&destination=${params.latitude},${params.longitude}`);
    }

    const { data: insertedOrder, error } = await supabase
      .from("orders")
      .insert({
        customer_name: params.customerName || "Valued Customer",
        customer_phone: cleanPhone || "9999999999",
        customer_address: addressParts.join(" | "),
        customer_locality: params.locality || "Srinagar",
        customer_pincode: params.pincode || "",
        items,
        subtotal,
        delivery_fee: deliveryFee,
        total: Number(params.amount || 0),
        delivery_zone: params.deliveryZone || "express_delivery",
        status: "confirmed",
      })
      .select("*")
      .single();

    if (error || !insertedOrder) {
      console.warn("[Cashfree Webhook] autoPoolOrderToSupabase insert error:", error?.message);
      return null;
    }

    await logOrderToVendingSales(
      {
        id: insertedOrder.id,
        order_number: insertedOrder.order_number,
        customer_name: params.customerName || "Valued Customer",
        customer_phone: cleanPhone,
        items,
        total: Number(params.amount || 0),
        subtotal,
        is_scheduled: Boolean(params.isScheduled),
        scheduled_date: params.scheduledDate || undefined,
        scheduled_slot: params.scheduledSlot || undefined,
      },
      params.paymentId,
      supabase
    );

    if (cleanPhone.length === 10) {
      try {
        await supabase
          .from("leads")
          .update({
            status: "converted",
            notes: `Converted to Order #${insertedOrder.order_number || params.orderRef}. Cashfree: ${params.paymentId}`,
            updated_at: new Date().toISOString(),
          })
          .eq("customer_phone", cleanPhone);
      } catch (_) {}

      try {
        await supabase.from("customers").upsert(
          {
            phone: cleanPhone,
            name: params.customerName || "Valued Customer",
            locality: params.locality || "Srinagar",
            pincode: params.pincode || "",
            notes: `Order #${insertedOrder.order_number || params.orderRef}`,
            last_order_at: new Date().toISOString(),
          },
          { onConflict: "phone" }
        );
      } catch (_) {}
    }

    return insertedOrder;
  } catch (err) {
    console.warn("[Cashfree Webhook] autoPoolOrderToSupabase exception:", err);
    return null;
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, gateway: "cashfree", status: "webhook_ready" });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || rawBody.trim() === "{}") {
      return NextResponse.json({ ok: true, ping: true });
    }

    const event = JSON.parse(rawBody);
    const eventType = String(event.type || "").toUpperCase();
    const data = event.data || {};

    // No-op HTTP 200 for Cashfree dashboard connectivity / "Test & Add" pings (never mutates DB or alerts)
    const isSyntheticTestPing =
      eventType === "WEBHOOK_TEST" ||
      eventType === "TEST" ||
      (data?.link_id === "payment_ps11" && Number(data?.cf_link_id) === 1576977);

    if (isSyntheticTestPing) {
      return NextResponse.json({ ok: true, test: true });
    }

    const signature = request.headers.get("x-webhook-signature");
    const timestamp = request.headers.get("x-webhook-timestamp");
    const { webhookSecret } = getCashfreeCredentials();

    const hmacValid = Boolean(
      signature && timestamp && verifyCashfreeWebhookSignature(rawBody, signature, timestamp)
    );

    if (webhookSecret && !hmacValid) {
      // Cashfree Payment Link v1 webhooks can omit v2 timestamp headers; confirm directly via Cashfree REST API before trusting.
      let serverVerified = false;
      try {
        if (eventType === "PAYMENT_LINK_EVENT" && data?.link_id) {
          const linkRes = await getCashfreePaymentLink(String(data.link_id));
          const linkStatus = String(linkRes.data?.link_status || "").toUpperCase();
          serverVerified = linkRes.ok && (linkStatus === "PAID" || Number(linkRes.data?.link_amount_paid || 0) > 0);
        } else if (data?.order?.order_id || data?.order_id) {
          const orderRes = await getCashfreeOrder(String(data.order?.order_id || data.order_id));
          serverVerified = orderRes.ok && String(orderRes.data?.order_status || "").toUpperCase() === "PAID";
        }
      } catch (_) {
        serverVerified = false;
      }

      if (!serverVerified) {
        console.error("[Cashfree Webhook] Invalid signature and server verification failed!");
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    }

    if (eventType === "PAYMENT_FAILED_WEBHOOK" || eventType === "PAYMENT_USER_DROPPED_WEBHOOK") {
      console.warn(`[Cashfree Webhook] ${eventType} for order ${data.order?.order_id}`);
      return NextResponse.json({ received: true });
    }

    // Handle both Order PG Payment Success & Payment Link Paid events
    const isOrderSuccess = eventType === "PAYMENT_SUCCESS_WEBHOOK" || (data.payment?.payment_status === "SUCCESS");
    const isLinkPaid =
      eventType === "PAYMENT_LINK_EVENT" &&
      String(data.link_status || "").toUpperCase() === "PAID" &&
      Number(data.link_amount_paid || data.order?.order_amount || 0) > 0;

    if (!isOrderSuccess && !isLinkPaid) {
      return NextResponse.json({ received: true, ignored: eventType });
    }

    const cfOrderId = String(
      data.order?.order_id || data.order_id || data.link_id || ""
    ).trim();
    const cfPaymentId = String(
      data.payment?.cf_payment_id ||
        data.order?.transaction_id ||
        (cfOrderId ? `cf_${cfOrderId}` : `cf_${Date.now()}`)
    ).trim();
    const paymentLinkId = data.link_id ? String(data.link_id) : null;

    const locked = await acquirePaymentLock(cfPaymentId);
    if (!locked) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Load saved Checkout context if this order originated from website checkout
    let savedCtx: any = null;
    if (cfOrderId) {
      try {
        const { data: ctxRow } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", `cf_order_ctx_${cfOrderId}`)
          .maybeSingle();
        if (ctxRow?.value) {
          savedCtx = JSON.parse(ctxRow.value);
        }
      } catch (_) {}
    }

    const linkNotes = data.link_notes || data.order?.order_tags || {};
    const orderRef = String(
      linkNotes.order_ref || savedCtx?.order_id || cfOrderId || cfPaymentId
    );
    const invoiceId = linkNotes.invoice_id ? String(linkNotes.invoice_id) : null;

    const customerPhone = String(
      linkNotes.customer_phone ||
        savedCtx?.customer_phone ||
        data.customer_details?.customer_phone ||
        data.payment?.payment_method?.upi?.customer_phone ||
        ""
    )
      .replace(/\D/g, "")
      .slice(-10);

    const customerName = String(
      savedCtx?.customer_name ||
        linkNotes.customer_name ||
        data.customer_details?.customer_name ||
        "Customer"
    ).trim();

    const customerEmail =
      savedCtx?.customer_email || data.customer_details?.customer_email || null;

    const amount = Number(
      data.payment?.payment_amount ||
        data.link_amount_paid ||
        data.order?.order_amount ||
        savedCtx?.total ||
        0
    );

    const methodGroup = String(
      data.payment?.payment_group || (data.payment?.payment_method?.upi ? "upi" : "online")
    ).toLowerCase();
    const vpa = data.payment?.payment_method?.upi?.upi_id || null;
    const bankCode = data.payment?.payment_method?.netbanking?.netbanking_bank_code || null;
    const walletName = data.payment?.payment_method?.wallet?.provider || null;
    const cardDetails = data.payment?.payment_method?.card
      ? {
          network: data.payment.payment_method.card.card_network,
          type: data.payment.payment_method.card.card_type,
          last4: String(data.payment.payment_method.card.card_number || "").slice(-4),
          issuer: data.payment.payment_method.card.card_bank_name,
        }
      : null;

    const feeCharge =
      typeof data.charges_details?.service_charge === "number"
        ? data.charges_details.service_charge
        : null;
    const feeTax =
      typeof data.charges_details?.service_tax === "number"
        ? data.charges_details.service_tax
        : null;

    const itemsSummary =
      savedCtx?.items?.map((i: any) => `${i.quantity} ${i.unit || "Kg"} ${i.name}`).join(", ") ||
      linkNotes.items_summary ||
      data.link_purpose ||
      data.order?.order_note ||
      "Fresh Rainbow Trout";

    const channel =
      linkNotes.channel ||
      (savedCtx ? "WEBSITE_CHECKOUT" : isLinkPaid ? "WHATSAPP_AI_AGENT" : "CASHFREE_PG");

    // 1. Auto-settle Khata ledger if applicable
    const khataRes = await autoSettleKhataPayment({
      paymentId: cfPaymentId,
      paymentLinkId,
      orderRef,
      amount,
      customerPhone,
      customerName,
      notes: linkNotes,
      method: "Cashfree Link (Verified)",
    });

    // 2. Mark invoice row PAID if invoiceId matches
    const lookupInvId = invoiceId || khataRes.invoiceId || orderRef;
    if (lookupInvId) {
      try {
        const cleanDigits = String(lookupInvId).replace(/\D/g, "");
        const { data: invRow } = await supabase
          .from("invoices")
          .select("id, data")
          .or(cleanDigits ? `id.eq.${lookupInvId},id.eq.${cleanDigits}` : `id.eq.${lookupInvId}`)
          .maybeSingle();

        if (invRow?.data) {
          const d = typeof invRow.data === "object" ? invRow.data : JSON.parse(invRow.data || "{}");
          d.paymentStatus = "PAID";
          d.status = "confirmed";
          d.paymentId = cfPaymentId;
          d.paymentMethod = `Cashfree (${methodGroup.toUpperCase()})`;
          d.paidAmount = Number(d.paidAmount || 0) + amount;
          d.balanceAmount = Math.max(0, Number(d.tot || d.grandTotal || amount) - d.paidAmount);
          d.balanceStatus = d.balanceAmount <= 0 ? "settled" : "pending";
          await supabase.from("invoices").update({ data: d }).eq("id", invRow.id);
        }
      } catch (_) {}
    }

    // 3. Auto-pool retail Website / WhatsApp / QR orders into `orders` & `vending_sales_log`
    let pooledOrder: any = null;
    const isKhataPayment = khataRes.settled || /^(?:BAL|KHATA|LEDGER)-/i.test(orderRef);
    const isCounterQr = channel === "COUNTER_POS_QR" || channel === "APPLE_SHORTCUT_QUICK_QR";

    if (!isKhataPayment && !isCounterQr) {
      pooledOrder = await autoPoolOrderToSupabase({
        orderRef,
        paymentId: cfPaymentId,
        amount,
        customerName,
        customerPhone,
        customerEmail,
        locality: savedCtx?.locality || linkNotes.locality,
        address: savedCtx?.address,
        pincode: savedCtx?.pincode,
        latitude: savedCtx?.latitude || (linkNotes.latitude ? Number(linkNotes.latitude) : undefined),
        longitude: savedCtx?.longitude || (linkNotes.longitude ? Number(linkNotes.longitude) : undefined),
        distanceKm: savedCtx?.distance_km || (linkNotes.distance_km ? Number(linkNotes.distance_km) : undefined),
        googleMapsUrl: savedCtx?.google_maps_url || linkNotes.google_maps_url,
        deliveryZone: savedCtx?.delivery_zone,
        deliveryFee: savedCtx?.delivery_fee,
        items: savedCtx?.items,
        itemsSummary,
        isScheduled: savedCtx?.is_scheduled,
        scheduledDate: savedCtx?.scheduled_date,
        scheduledSlot: savedCtx?.scheduled_slot,
        channel,
      });
    }

    const displayOrderRef = pooledOrder?.order_number || orderRef;

    // 4. Send Telegram notification (atomic dedup prevents duplicates)
    await notifyCashfreePayment({
      paymentId: cfPaymentId,
      orderId: displayOrderRef,
      amount,
      status: "captured",
      method: methodGroup,
      vpa,
      bank: bankCode,
      wallet: walletName,
      card: cardDetails,
      fee: feeCharge,
      tax: feeTax,
      customerName,
      customerPhone,
      customerEmail,
      description: itemsSummary,
      channel,
      googleMapsUrl: savedCtx?.google_maps_url || null,
      latitude: savedCtx?.latitude || null,
      longitude: savedCtx?.longitude || null,
      distanceKm: savedCtx?.distance_km || null,
    });

    // 5. Send Confirmation Email via Resend
    await sendPaymentLinkConfirmationEmail({
      orderRef: displayOrderRef,
      customerName,
      customerPhone,
      customerEmail,
      amount,
      paymentId: cfPaymentId,
      paymentLinkId: paymentLinkId || undefined,
      paymentMethod: `Cashfree (${methodGroup.toUpperCase()})`,
      itemsSummary,
    }).catch(() => {});

    // 6. Enqueue WhatsApp confirmation if non-Khata retail order
    if (!isKhataPayment && !isCounterQr && customerPhone.length === 10) {
      const slotNote = savedCtx?.is_scheduled && savedCtx?.scheduled_slot
        ? `Scheduled Slot: *${savedCtx.scheduled_date || "Advance"} (${savedCtx.scheduled_slot})*`
        : "Express delivery within *90–120 minutes* to your shared GPS location";
      const waMsg = `✅ *Order Confirmed & Paid!* 🐟\n\nThank you! Your payment of *₹${amount.toLocaleString("en-IN")}* via Cashfree has been verified.\n\n• *Order Ref:* #${displayOrderRef}\n• *Items:* ${itemsSummary}\n• *Status:* Fresh live harvest initiated (${slotNote})\n• *Txn ID:* ${cfPaymentId}\n\nThank you for choosing Urban Trout Aquaculture!`;

      await enqueueWhatsAppDispatch({
        orderRef: displayOrderRef,
        phone: customerPhone,
        customerName,
        status: "payment_confirmed",
        messageText: waMsg,
        paymentId: cfPaymentId,
      }).catch(() => {});
    }

    return NextResponse.json({
      received: true,
      processed: true,
      orderRef: displayOrderRef,
      paymentId: cfPaymentId,
      khataSettled: khataRes.settled,
    });
  } catch (err: any) {
    console.error("[Cashfree Webhook] Processing error:", err);
    return NextResponse.json(
      { error: err?.message || "Cashfree webhook handler error" },
      { status: 500 }
    );
  }
}
