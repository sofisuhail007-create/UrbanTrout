import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit";
import { getBusinessHoursInfo, StoreSettingsOverrides } from "@/lib/businessHours";
import { getLiveAquariumStock } from "@/lib/aquariumStock";
import { evaluateDeliveryZone } from "@/lib/deliveryZones";
import { cashfreeFetch, getCashfreeMode, normalizeIndianPhone } from "@/lib/cashfree";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_PRICES: Record<string, number> = {
  "gutted-trout": 580,
  "whole-trout": 540,
};

export async function POST(request: Request) {
  const { limited } = checkRateLimit(request, 15, 60 * 1000);
  if (limited) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const {
      items,
      localityInput = "",
      coords = null,
      deliveryMode = "delivery",
      isScheduledOrder = false,
      scheduledDate = "",
      scheduledSlot = "",
      customerPhone = "",
      customerName = "",
      customerEmail = "",
      notes = {},
    } = body;

    // 1. Verify store operational status
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "store_manually_closed",
        "farm_maintenance_active",
        "allow_friday_orders",
        "force_store_open",
        "out_of_stock_manual",
      ]);

    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((r) => {
      if (r.key) settingsMap[r.key] = r.value;
    });

    const overrides: StoreSettingsOverrides = {
      storeManuallyClosed: settingsMap.store_manually_closed === "true",
      farmMaintenanceActive: settingsMap.farm_maintenance_active === "true",
      allowFridayOrders: settingsMap.allow_friday_orders === "true",
      forceStoreOpen: settingsMap.force_store_open === "true",
    };

    const hours = getBusinessHoursInfo(new Date(), overrides);
    if (!hours.isOpen && !isScheduledOrder) {
      const msg =
        hours.closedReason === "friday_maintenance"
          ? "Store & deliveries are closed on Fridays for farm bio-security maintenance. Please select a Saturday pre-order slot."
          : hours.closedReason === "farm_maintenance" || hours.closedReason === "manual"
          ? "Our farm is temporarily closed for maintenance. Please choose a scheduled advance slot."
          : `Deliveries operate 8:00 AM – 8:00 PM IST. Please book a scheduled slot (opens ${hours.nextOpenLabel || "at 8:00 AM"}).`;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (settingsMap.out_of_stock_manual === "true") {
      return NextResponse.json(
        { error: "Live harvest stock is currently sold out. Please check back shortly." },
        { status: 400 }
      );
    }

    // 2. Validate cart items & compute authoritative server prices
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }

    const { data: invRows } = await supabase
      .from("inventory")
      .select("product_id, product_name, price_per_kg, available");

    const priceMap = new Map<string, number>();
    const availMap = new Map<string, boolean>();
    (invRows || []).forEach((r: any) => {
      if (r.product_id) {
        priceMap.set(r.product_id, Number(r.price_per_kg) || DEFAULT_PRICES[r.product_id] || 580);
        availMap.set(r.product_id, r.available !== false);
      }
    });

    let serverSubtotal = 0;
    let totalWeightKg = 0;
    const itemSummaries: string[] = [];

    for (const item of items) {
      const id = String(item.id || "");
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0 || qty > 100) {
        return NextResponse.json({ error: `Invalid item quantity for ${id || "item"}` }, { status: 400 });
      }
      if (availMap.has(id) && !availMap.get(id)) {
        return NextResponse.json({ error: `${item.name || id} is currently unavailable.` }, { status: 400 });
      }

      const unitPrice = priceMap.get(id) ?? DEFAULT_PRICES[id] ?? Number(item.price) ?? 580;
      serverSubtotal += Math.round(unitPrice * qty);
      totalWeightKg += qty;
      itemSummaries.push(`${qty} kg ${item.name || id}`);
    }

    // 3. Verify live aquarium stock sufficiency
    const liveStock = await getLiveAquariumStock(supabase);
    if (liveStock.totalProcuredKg > 0 && liveStock.remainingKg < totalWeightKg) {
      return NextResponse.json(
        {
          error: `Only ${Math.max(0, liveStock.remainingKg).toFixed(1)} kg live catch available in tanks right now.`,
        },
        { status: 400 }
      );
    }

    // 4. Compute server-verified delivery fee
    let deliveryFee = 0;
    if (deliveryMode !== "pickup") {
      const zone = evaluateDeliveryZone({
        localityInput: String(localityInput || ""),
        coords: coords && typeof coords.lat === "number" && typeof coords.lng === "number" ? coords : null,
        weightKg: totalWeightKg,
      });

      if (!zone.isDeliverable) {
        return NextResponse.json(
          { error: "Selected address is outside our 16 km express delivery perimeter. Please select Malabagh Farm Pickup." },
          { status: 400 }
        );
      }
      deliveryFee = zone.deliveryFee;
    }

    const finalAmountRupees = Math.round((serverSubtotal + deliveryFee) * 100) / 100;
    if (finalAmountRupees < 1) {
      return NextResponse.json({ error: "Order total must be at least ₹1" }, { status: 400 });
    }

    const origin = new URL(request.url).origin || "https://urbantrout.in";
    const orderId = `UT_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const cleanPhone = normalizeIndianPhone(customerPhone || notes.customer_phone);
    const cleanName = String(customerName || notes.customer_name || "Valued Customer").trim().slice(0, 40) || "Valued Customer";
    const cleanEmail = String(customerEmail || notes.customer_email || "").trim().slice(0, 60);

    // 5. Persist rich order metadata in app_settings so webhook has complete address/GPS/items even on browser close
    try {
      await supabase.from("app_settings").upsert(
        {
          key: `cf_order_ctx_${orderId}`,
          value: JSON.stringify({
            order_id: orderId,
            customer_name: cleanName,
            customer_phone: cleanPhone,
            customer_email: cleanEmail || null,
            locality: String(localityInput || notes.locality || "").slice(0, 100),
            address: String(notes.address || "").slice(0, 400),
            pincode: String(notes.pincode || "").slice(0, 12),
            latitude: notes.latitude ?? coords?.lat ?? null,
            longitude: notes.longitude ?? coords?.lng ?? null,
            distance_km: notes.distance_km ?? null,
            google_maps_url: notes.google_maps_url || null,
            delivery_zone: deliveryMode === "pickup" ? "farm_pickup" : "express_delivery",
            delivery_fee: deliveryFee,
            subtotal: serverSubtotal,
            total: finalAmountRupees,
            items: items.map((i: any) => ({
              id: i.id,
              name: i.name,
              quantity: Number(i.quantity),
              unit: i.unit || "Kg",
              price: priceMap.get(String(i.id || "")) ?? DEFAULT_PRICES[String(i.id || "")] ?? Number(i.price) ?? 580,
            })),
            is_scheduled: Boolean(isScheduledOrder),
            scheduled_date: isScheduledOrder ? String(scheduledDate || "").slice(0, 30) : "",
            scheduled_slot: isScheduledOrder ? String(scheduledSlot || "").slice(0, 30) : "",
            created_at: new Date().toISOString(),
          }),
          description: "Pending Cashfree Checkout Context",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    } catch (_) {
      // Non-fatal
    }

    // 6. Create Cashfree PG Order
    const cfPayload = {
      order_id: orderId,
      order_amount: finalAmountRupees,
      order_currency: "INR",
      customer_details: {
        customer_id: `cust_${cleanPhone}`,
        customer_name: cleanName,
        customer_email: cleanEmail || "orders@urbantrout.in",
        customer_phone: cleanPhone,
      },
      order_meta: {
        return_url: `${origin}/checkout?cf_order_id={order_id}`,
        notify_url: `${origin}/api/cashfree/webhook`,
      },
      order_note: `Urban Trout: ${itemSummaries.join(", ")}`.slice(0, 200),
      order_tags: {
        channel: "WEBSITE_CHECKOUT",
        customer_phone: cleanPhone,
        customer_name: cleanName.slice(0, 40),
        is_scheduled: isScheduledOrder ? "true" : "false",
        scheduled_slot: isScheduledOrder ? String(scheduledSlot || "").slice(0, 30) : "express",
        items_summary: itemSummaries.join(", ").slice(0, 120),
      },
    };

    const cfRes = await cashfreeFetch("/orders", { method: "POST", body: cfPayload });
    if (!cfRes.ok || !cfRes.data?.payment_session_id) {
      console.error("Cashfree create-order error:", cfRes.status, cfRes.data);
      return NextResponse.json(
        { error: cfRes.data?.message || "Failed to initialize Cashfree payment session" },
        { status: cfRes.status >= 400 ? cfRes.status : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order_id: cfRes.data.order_id,
      cf_order_id: cfRes.data.cf_order_id,
      payment_session_id: cfRes.data.payment_session_id,
      amount: Math.round(finalAmountRupees * 100),
      order_amount: finalAmountRupees,
      currency: "INR",
      mode: getCashfreeMode(),
    });
  } catch (err: any) {
    console.error("Cashfree create-order exception:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create Cashfree order" },
      { status: 500 }
    );
  }
}
