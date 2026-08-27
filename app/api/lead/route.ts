import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lead } = body;

    if (!lead || !lead.customer_phone) {
      return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });
    }

    const cleanPhone = String(lead.customer_phone).replace(/\D/g, "").slice(-10);

    const payload = {
      customer_name: lead.customer_name?.trim() || "Interested Customer",
      customer_phone: cleanPhone,
      customer_email: lead.customer_email?.trim() || null,
      customer_locality: lead.customer_locality?.trim() || null,
      customer_address: lead.customer_address?.trim() || null,
      customer_pincode: lead.customer_pincode?.trim() || null,
      cart_items: lead.cart_items || [],
      estimated_total: Number(lead.estimated_total) || 0,
      status: lead.status || "abandoned",
      notes: lead.notes || null,
      updated_at: new Date().toISOString(),
    };

    // Check if an abandoned lead with this phone already exists
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("customer_phone", cleanPhone)
      .eq("status", "abandoned")
      .maybeSingle();

    let leadId = existing?.id;

    if (leadId) {
      await supabase.from("leads").update(payload).eq("id", leadId);
    } else {
      const { data, error } = await supabase.from("leads").insert([payload]).select("id").single();
      if (error) {
        console.error("API Lead Insert Error:", error.message);
      }
      leadId = data?.id;
    }

    // Also update customers table
    try {
      await supabase.from("customers").upsert(
        {
          phone: cleanPhone,
          name: payload.customer_name,
          locality: payload.customer_locality || "Srinagar",
          pincode: payload.customer_pincode || "190006",
          notes: payload.notes || `Abandoned lead (₹${payload.estimated_total})`,
          last_order_at: new Date().toISOString(),
        },
        { onConflict: "phone" }
      );
    } catch (_) {}

    return NextResponse.json({ success: true, leadId });
  } catch (err: any) {
    console.error("Lead API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, leads: leads || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

