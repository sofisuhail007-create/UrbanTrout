import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fallback pricing if database is unreachable
const FALLBACK_PRICES: Record<string, number> = {
  "gutted-trout": 580,
  "whole-trout": 540,
};

export async function POST(req: NextRequest) {
  // 1. Rate Limiting: 15 order creation attempts per minute per IP
  const { limited } = checkRateLimit(req, 15, 60 * 1000);
  if (limited) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

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
    const {
      amount: clientAmount,
      items,
      deliveryMode = "express_delivery",
      deliveryFee: clientDeliveryFee = 0,
      customerName,
      customerPhone,
      customerEmail,
      notes = {},
    } = body;

    // Validate customer contact
    if (!customerPhone || typeof customerPhone !== "string") {
      return NextResponse.json({ error: "Valid customer phone number is required." }, { status: 400 });
    }

    // Business Hours & Friday Maintenance Check
    const { getBusinessHoursInfo } = await import("@/lib/businessHours");
    const hoursInfo = getBusinessHoursInfo();

    let isManuallyClosed = false;
    try {
      const { data: closedRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "store_manually_closed")
        .single();
      isManuallyClosed = closedRow?.value === "true";
    } catch {
      // ignore
    }

    if (!hoursInfo.isOpen || isManuallyClosed) {
      const closedMsg = isManuallyClosed
        ? "Our store is temporarily taking a break. Please try again when we reopen or contact us on WhatsApp."
        : hoursInfo.isFridayMaintenance
        ? `Our farm is closed on Fridays for scheduled Farm Maintenance. Fresh harvest resumes ${hoursInfo.nextOpenLabel || "Saturday at 7:00 AM"}.`
        : `Our store is currently closed. We harvest fresh trout to order during business hours (Saturday to Thursday, 7:00 AM – 10:00 PM). Opens ${hoursInfo.nextOpenLabel || "tomorrow at 7:00 AM"}.`;

      return NextResponse.json(
        {
          error: closedMsg,
          storeClosed: true,
          nextOpenLabel: hoursInfo.nextOpenLabel,
        },
        { status: 400 }
      );
    }

    // 2a. Live Aquarium Stock Verification: Urban Trout sells solely out of live aquarium biomass
    const { getLiveAquariumStock } = await import("@/lib/aquariumStock");
    const liveStock = await getLiveAquariumStock(supabase);

    const totalRequestedKg = Array.isArray(items) && items.length > 0
      ? items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0)
      : 0;

    if (liveStock.remainingKg <= 0 || (totalRequestedKg > 0 && liveStock.remainingKg < totalRequestedKg)) {
      const remainingDisplay = liveStock.remainingKg > 0 ? `${liveStock.remainingKg.toFixed(1)} kg available` : "All sold out";
      return NextResponse.json(
        {
          error: `Sorry, we are out of stock for today! All available live aquarium trout has been sold out (${remainingDisplay}, but ${totalRequestedKg.toFixed(1)} kg requested). Fresh harvest resumes ${hoursInfo.nextOpenLabel || "tomorrow at 7:00 AM"}.`,
          outOfStock: true,
          remainingKg: liveStock.remainingKg,
        },
        { status: 400 }
      );
    }

    let finalAmountPaise: number;

    // 2b. Server-Side Price Verification: If items array is provided, recalculate against database
    if (Array.isArray(items) && items.length > 0) {
      // Fetch current product prices from database
      const { data: invData } = await supabase
        .from("inventory")
        .select("product_id, price_per_kg, available");

      const priceMap = new Map<string, number>();
      (invData || []).forEach((item) => {
        if (item.product_id && item.price_per_kg) {
          priceMap.set(item.product_id, Number(item.price_per_kg));
        }
      });

      let calculatedSubtotal = 0;
      for (const it of items) {
        const qty = Number(it.quantity);
        if (isNaN(qty) || qty <= 0 || qty > 100) {
          return NextResponse.json({ error: `Invalid quantity for item ${it.id}` }, { status: 400 });
        }

        const pricePerKg = priceMap.get(it.id) || FALLBACK_PRICES[it.id] || 500;
        calculatedSubtotal += Math.round(pricePerKg * qty);
      }

      // Determine delivery fee on server
      let calculatedDeliveryFee = 0;
      if (deliveryMode === "farm_pickup") {
        calculatedDeliveryFee = 0;
      } else {
        // Standard delivery is free within 5km, or ₹40 outside
        calculatedDeliveryFee = clientDeliveryFee === 40 ? 40 : 0;
      }

      const calculatedGrandTotal = calculatedSubtotal + calculatedDeliveryFee;
      finalAmountPaise = calculatedGrandTotal * 100;
    } else if (typeof clientAmount === "number" && clientAmount >= 100) {
      // Fallback if client did not pass detailed items
      finalAmountPaise = Math.round(clientAmount);
    } else {
      return NextResponse.json({ error: "Invalid order amount or items." }, { status: 400 });
    }

    // Minimum amount sanity check (₹100 = 10,000 paise minimum for fresh trout delivery)
    if (finalAmountPaise < 10000) {
      return NextResponse.json(
        { error: "Order value is below the minimum threshold." },
        { status: 400 }
      );
    }

    const orderNotes: Record<string, string> = {
      customer_name: String(customerName || notes.customer_name || "Valued Customer").slice(0, 40),
      customer_phone: String(customerPhone || notes.customer_phone || "").slice(0, 15),
      server_verified: "true",
      ...notes,
    };
    if (customerEmail) orderNotes.customer_email = String(customerEmail).slice(0, 40);

    const order = await razorpay.orders.create({
      amount: finalAmountPaise, // in paise
      currency: "INR",
      receipt: `ut_${Date.now()}`,
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
