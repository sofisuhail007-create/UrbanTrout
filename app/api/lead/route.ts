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
      notes: lead.notes || `Abandoned checkout (₹${lead.estimated_total || 0})`,
      updated_at: new Date().toISOString(),
    };

    // Check if lead(s) with this phone already exist
    const { data: existingList } = await supabase
      .from("leads")
      .select("id, created_at")
      .eq("customer_phone", cleanPhone)
      .order("created_at", { ascending: false });

    let primaryLeadId: string | undefined;

    if (existingList && existingList.length > 0) {
      primaryLeadId = existingList[0].id;
      // Update the primary lead
      await supabase.from("leads").update(payload).eq("id", primaryLeadId);

      // Clean up any extra duplicates for this phone
      if (existingList.length > 1) {
        const duplicateIds = existingList.slice(1).map((e) => e.id);
        await supabase.from("leads").delete().in("id", duplicateIds);
      }
    } else {
      const { data, error } = await supabase.from("leads").insert([payload]).select("id").single();
      if (error) {
        console.error("API Lead Insert Error:", error.message);
      }
      primaryLeadId = data?.id;
    }

    // Also update customers table
    try {
      await supabase.from("customers").upsert(
        {
          phone: cleanPhone,
          name: payload.customer_name,
          locality: payload.customer_locality || "Srinagar",
          pincode: payload.customer_pincode || "190006",
          notes: payload.notes,
          last_order_at: new Date().toISOString(),
        },
        { onConflict: "phone" }
      );
    } catch (_) {}

    return NextResponse.json({ success: true, leadId: primaryLeadId });
  } catch (err: any) {
    console.error("Lead API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data: rawLeads, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Deduplicate in memory by customer_phone so only the latest record is displayed
    const seenPhones = new Set<string>();
    const deduplicated: any[] = [];

    for (const lead of rawLeads || []) {
      const cleanPhone = (lead.customer_phone || "").replace(/\D/g, "").slice(-10);
      const key = cleanPhone || lead.id;
      if (!seenPhones.has(key)) {
        seenPhones.add(key);
        deduplicated.push(lead);
      }
    }

    return NextResponse.json({ success: true, leads: deduplicated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const phone = searchParams.get("phone");

    if (!id && !phone) {
      return NextResponse.json({ success: false, error: "Missing id or phone" }, { status: 400 });
    }

    if (id) {
      await supabase.from("leads").delete().eq("id", id);
    }

    if (phone) {
      const clean = phone.replace(/\D/g, "").slice(-10);
      await supabase.from("leads").delete().eq("customer_phone", clean);
      try {
        await supabase.from("customers").delete().eq("phone", clean);
      } catch (_) {}
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
