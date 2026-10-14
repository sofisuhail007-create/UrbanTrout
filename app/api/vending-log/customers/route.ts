import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface CustomerRecord {
  id: string;
  phone: string;
  name: string;
  locality?: string;
  pincode?: string;
  total_orders: number;
  total_spent: number;
  last_order_at?: string;
  created_at?: string;
  notes?: string;
}

function getSearchVariants(term: string): string[] {
  const t = term.trim().toLowerCase().replace(/[,()]/g, "");
  if (!t) return [];
  const variants = new Set<string>([t]);

  // u <-> o at word boundary (e.g. uvais <-> ovais, umer <-> omer)
  if (t.startsWith("u")) variants.add("o" + t.slice(1));
  if (t.startsWith("o")) variants.add("u" + t.slice(1));

  // v <-> w (e.g. uvais <-> owais, parvaiz <-> parwaiz)
  variants.add(t.replace(/v/g, "w"));
  variants.add(t.replace(/w/g, "v"));

  // Combined u/o and v/w (e.g. uvais -> owais)
  if (t.startsWith("u")) {
    variants.add("o" + t.slice(1).replace(/v/g, "w"));
    variants.add("o" + t.slice(1).replace(/w/g, "v"));
  }
  if (t.startsWith("o")) {
    variants.add("u" + t.slice(1).replace(/v/g, "w"));
    variants.add("u" + t.slice(1).replace(/w/g, "v"));
  }

  // ee <-> i (e.g. saleem <-> salim)
  variants.add(t.replace(/ee/g, "i"));
  variants.add(t.replace(/i/g, "ee"));

  return Array.from(variants).filter((v) => v.length >= 2);
}

// GET /api/vending-log/customers?q=...
// Search customers by name or phone, or return top frequent customers
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  try {
    let query = supabase.from("customers").select("*");

    if (q) {
      const sanitized = q.replace(/[,()]/g, " ").trim();
      let digits = q.replace(/\D/g, "");
      if (digits.length > 10 && digits.startsWith("91")) {
        digits = digits.slice(-10);
      }

      const variants = getSearchVariants(sanitized);
      const orClauses: string[] = [];
      for (const v of variants) {
        orClauses.push(`name.ilike.%${v}%`);
      }
      if (digits.length >= 2) {
        orClauses.push(`phone.ilike.%${digits}%`);
      }

      if (orClauses.length > 0) {
        query = query.or(orClauses.join(","));
      } else {
        query = query.ilike("name", `%${sanitized}%`);
      }

      query = query
        .order("total_spent", { ascending: false })
        .order("total_orders", { ascending: false })
        .limit(20);
    } else {
      // If no query, return recently active / top customers for instant suggestions
      query = query
        .order("last_order_at", { ascending: false, nullsFirst: false })
        .order("total_spent", { ascending: false })
        .limit(15);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      customers: data || [],
      count: data?.length || 0,
    });
  } catch (err: any) {
    console.error("[api/vending-log/customers] GET error:", err);
    // Fallback to app_settings if table error
    try {
      const { data: fallback } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "vending_customers_data")
        .maybeSingle();

      const existing: any[] = fallback?.value ? JSON.parse(fallback.value) : [];
      let filtered = existing;
      if (q) {
        const lowerQ = q.toLowerCase();
        const digits = q.replace(/\D/g, "");
        filtered = existing.filter((c: any) =>
          (c.name && c.name.toLowerCase().includes(lowerQ)) ||
          (digits && c.phone && c.phone.includes(digits))
        );
      }
      filtered.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
      return NextResponse.json({
        success: true,
        customers: filtered.slice(0, 20),
        count: filtered.length,
        fallback: true,
      });
    } catch {
      return NextResponse.json({ success: false, error: err?.message || "Search failed" }, { status: 500 });
    }
  }
}

// POST /api/vending-log/customers
// Record or update customer purchases in the database
export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { name, phone, amount, date, product_type, locality, notes } = body;

  if (!phone || !name) {
    return NextResponse.json({ success: false, error: "name and phone are required" }, { status: 400 });
  }

  const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) {
    return NextResponse.json({ success: false, error: "Phone number must be 10 digits" }, { status: 400 });
  }

  const paidAmount = Math.round(Number(amount) || 0);
  const nowIso = new Date().toISOString();
  const isDateOnly = date && /^\d{4}-\d{2}-\d{2}$/.test(String(date).trim());
  const saleDate = isDateOnly ? nowIso : (date || nowIso);

  try {
    const { data: existing } = await supabase
      .from("customers")
      .select("id, name, total_orders, total_spent, locality, notes")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existing) {
      const newOrders = (existing.total_orders || 0) + 1;
      const newSpent = (existing.total_spent || 0) + paidAmount;

      const { data: updated, error: updErr } = await supabase
        .from("customers")
        .update({
          name: name.trim() || existing.name,
          total_orders: newOrders,
          total_spent: newSpent,
          last_order_at: saleDate,
          locality: locality || existing.locality || "Srinagar (Counter)",
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updErr) throw updErr;

      return NextResponse.json({
        success: true,
        is_new: false,
        customer: updated || { ...existing, total_orders: newOrders, total_spent: newSpent },
      });
    }

    // New Customer
    const { data: created, error: insErr } = await supabase
      .from("customers")
      .insert({
        phone: cleanPhone,
        name: name.trim(),
        locality: locality || "Srinagar (Counter)",
        pincode: "190001",
        total_orders: 1,
        total_spent: paidAmount,
        last_order_at: saleDate,
        notes: notes || `[Vending Counter] Added ${new Date().toLocaleDateString("en-IN")}${product_type ? ` — ${product_type}` : ""}.`,
        created_at: nowIso,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    return NextResponse.json({
      success: true,
      is_new: true,
      customer: created,
    });
  } catch (err: any) {
    console.error("[api/vending-log/customers] POST error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to save customer" }, { status: 500 });
  }
}
