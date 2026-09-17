import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface CustomerSyncPayload {
  name: string;
  phone: string;
  amount: number;
  date: string;
  product_type?: string;
}

export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let body: CustomerSyncPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, phone, amount, date, product_type } = body;

  if (!phone || !name) {
    return NextResponse.json({ success: false, error: "name and phone are required" }, { status: 400 });
  }

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) {
    return NextResponse.json({ success: false, error: "Invalid phone number" }, { status: 400 });
  }

  const paidAmount = Number(amount) || 0;
  const saleDate = date || new Date().toISOString();

  try {
    const { data: existing } = await supabase
      .from("customers")
      .select("id, name, total_orders, total_spent")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existing) {
      await supabase.from("customers").update({
        name: name.trim(),
        total_orders: (existing.total_orders || 0) + 1,
        total_spent: (existing.total_spent || 0) + paidAmount,
        last_order_at: new Date(saleDate).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);

      return NextResponse.json({ success: true, is_new: false, customer_id: existing.id });
    }

    const { data: created, error: insErr } = await supabase.from("customers").insert({
      phone: cleanPhone,
      name: name.trim(),
      locality: "Srinagar (Counter)",
      pincode: "190001",
      total_orders: 1,
      total_spent: paidAmount,
      last_order_at: new Date(saleDate).toISOString(),
      notes: `[Vending Counter] First sale${product_type ? ` — ${product_type}` : ""}. Added ${new Date().toLocaleDateString("en-IN")}.`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select("id").single();

    if (insErr) throw insErr;

    return NextResponse.json({ success: true, is_new: true, customer_id: created?.id });
  } catch (err: any) {
    console.error("[customer-sync] Error:", err);
    try {
      const { data: fallback } = await supabase.from("app_settings").select("value").eq("key", "vending_customers_data").single();
      const existing: any[] = fallback?.value ? JSON.parse(fallback.value) : [];
      const idx = existing.findIndex((c: any) => c.phone === cleanPhone);
      if (idx >= 0) {
        existing[idx].total_orders = (existing[idx].total_orders || 0) + 1;
        existing[idx].total_spent = (existing[idx].total_spent || 0) + paidAmount;
        existing[idx].last_order_at = new Date(saleDate).toISOString();
        existing[idx].name = name.trim();
      } else {
        existing.push({ id: `vc_${Date.now()}`, phone: cleanPhone, name: name.trim(), total_orders: 1, total_spent: paidAmount, last_order_at: new Date(saleDate).toISOString(), source: "vending_counter", created_at: new Date().toISOString() });
      }
      await supabase.from("app_settings").upsert({ key: "vending_customers_data", value: JSON.stringify(existing.slice(0, 2000)), description: "Fallback vending counter customer DB", updated_at: new Date().toISOString() }, { onConflict: "key" });
      return NextResponse.json({ success: true, is_new: idx < 0, fallback: true });
    } catch {
      return NextResponse.json({ success: false, error: err?.message || "Failed" }, { status: 500 });
    }
  }
}
