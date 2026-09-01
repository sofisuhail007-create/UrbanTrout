import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

// Use service role key if configured in Vercel to bypass RLS, or fallback to anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

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

      // Clean up any extra duplicate rows for this same phone
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

export async function GET(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { data: rawLeads, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("API Lead GET error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Deduplicate in memory by clean customer_phone so only the latest record per customer is returned
    const seenPhones = new Set<string>();
    const deduplicated: any[] = [];

    for (const lead of rawLeads || []) {
      const cleanPhone = (lead.customer_phone || "").replace(/\D/g, "").slice(-10);
      const key = cleanPhone || lead.id;
      if (!seenPhones.has(key)) {
        seenPhones.add(key);
        deduplicated.push({
          ...lead,
          customer_phone: cleanPhone || lead.customer_phone,
        });
      }
    }

    return NextResponse.json({ success: true, leads: deduplicated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const phone = searchParams.get("phone");

    if (!id && !phone) {
      return NextResponse.json({ success: false, error: "Missing id or phone" }, { status: 400 });
    }

    if (phone) {
      const clean = phone.replace(/\D/g, "").slice(-10);
      // Delete all matching records in leads by phone
      const { error: delLeadErr } = await supabase.from("leads").delete().eq("customer_phone", clean);
      if (delLeadErr) console.error("Error deleting lead by phone:", delLeadErr.message);

      // Also delete from customers
      try {
        await supabase.from("customers").delete().eq("phone", clean);
      } catch (_) {}
    }

    if (id) {
      const { error: delIdErr } = await supabase.from("leads").delete().eq("id", id);
      if (delIdErr) console.error("Error deleting lead by ID:", delIdErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API Lead DELETE error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
