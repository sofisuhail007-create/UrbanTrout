import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    // 1. Fetch from Supabase customers table
    let dbCustomers: any[] = [];
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("last_order_at", { ascending: false, nullsFirst: false });
      if (!error && data) {
        dbCustomers = data;
      }
    } catch (e) {
      console.warn("[customers GET] db error:", e);
    }

    // 2. Fetch from app_settings fallback: vending_customers_data
    let fallbackCustomers: any[] = [];
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "vending_customers_data")
        .maybeSingle();
      if (data?.value) {
        fallbackCustomers = JSON.parse(data.value);
      }
    } catch (_) {}

    // 3. Check vending_log_data to uncover any customers stored in sales log custom_fields
    let vendingEntries: any[] = [];
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "vending_log_data")
        .maybeSingle();
      if (data?.value) {
        vendingEntries = JSON.parse(data.value);
      }
    } catch (_) {}

    // Also check vending_sales_entries table if present
    try {
      const { data } = await supabase
        .from("vending_sales_entries")
        .select("entry_date, amount_paid, custom_fields, product_type")
        .limit(1000);
      if (data && data.length > 0) {
        vendingEntries = [...vendingEntries, ...data];
      }
    } catch (_) {}

    // 4. Merge and consolidate by clean 10-digit phone
    const customerMap = new Map<string, any>();

    // Add database customers
    for (const c of dbCustomers) {
      const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
      if (!cleanPhone) continue;
      customerMap.set(cleanPhone, {
        id: c.id,
        phone: cleanPhone,
        name: c.name || "Customer",
        locality: c.locality || null,
        pincode: c.pincode || null,
        total_orders: Number(c.total_orders) || 0,
        total_spent: Number(c.total_spent) || 0,
        last_order_at: c.last_order_at || c.created_at || null,
        created_at: c.created_at || new Date().toISOString(),
        notes: c.notes || null,
        source: c.notes?.includes("Vending") ? "vending_counter" : "online",
      });
    }

    // Merge fallback customers
    for (const fc of fallbackCustomers) {
      const cleanPhone = (fc.phone || "").replace(/\D/g, "").slice(-10);
      if (!cleanPhone) continue;
      if (customerMap.has(cleanPhone)) {
        const existing = customerMap.get(cleanPhone);
        existing.total_orders = Math.max(existing.total_orders, Number(fc.total_orders) || 1);
        existing.total_spent = Math.max(existing.total_spent, Number(fc.total_spent) || 0);
        if (!existing.last_order_at && fc.last_order_at) existing.last_order_at = fc.last_order_at;
      } else {
        customerMap.set(cleanPhone, {
          id: fc.id || `vc_${Date.now()}_${cleanPhone}`,
          phone: cleanPhone,
          name: fc.name || "Counter Customer",
          locality: fc.locality || "Srinagar (Counter)",
          pincode: fc.pincode || "190001",
          total_orders: Number(fc.total_orders) || 1,
          total_spent: Number(fc.total_spent) || 0,
          last_order_at: fc.last_order_at || fc.created_at || null,
          created_at: fc.created_at || new Date().toISOString(),
          notes: fc.notes || "[Vending Counter]",
          source: "vending_counter",
        });
      }
    }

    // Merge from vending sales entries
    for (const v of vendingEntries) {
      const cf = v.custom_fields || {};
      const phone = cf.customer_phone || (v as any).customer_phone;
      const name = cf.customer_name || (v as any).customer_name;
      if (!phone) continue;
      const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
      if (cleanPhone.length !== 10) continue;

      const amt = Number(v.amount_paid) || 0;
      const date = v.entry_date || v.created_at || new Date().toISOString();

      if (customerMap.has(cleanPhone)) {
        const existing = customerMap.get(cleanPhone);
        if (name && (!existing.name || existing.name === "Customer")) {
          existing.name = name;
        }
      } else {
        customerMap.set(cleanPhone, {
          id: `vlog_${cleanPhone}`,
          phone: cleanPhone,
          name: name || "Counter Customer",
          locality: "Srinagar (Counter)",
          pincode: "190001",
          total_orders: 1,
          total_spent: amt,
          last_order_at: date,
          created_at: date,
          notes: `[Vending Counter] ${v.product_type ? `(${v.product_type})` : ""}`,
          source: "vending_counter",
        });
      }
    }

    const customers = Array.from(customerMap.values()).sort((a, b) => {
      const dateA = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
      const dateB = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ success: true, customers });
  } catch (err: any) {
    console.error("[customers GET] error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to fetch customers" }, { status: 500 });
  }
}

// ─── POST: Manually Add New Customer ───
export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, phone, locality, pincode, notes } = body;

    if (!phone || !name) {
      return NextResponse.json({ success: false, error: "Name and Phone are required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit phone number" }, { status: 400 });
    }

    const payload = {
      phone: cleanPhone,
      name: name.trim(),
      locality: locality?.trim() || "Srinagar",
      pincode: pincode?.trim() || "190001",
      total_orders: 0,
      total_spent: 0,
      last_order_at: null,
      notes: notes?.trim() || `[Manual Entry] Added on ${new Date().toLocaleDateString("en-IN")}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let customerRecord: any = null;

    try {
      const { data, error } = await supabase
        .from("customers")
        .upsert(payload, { onConflict: "phone" })
        .select()
        .single();
      if (!error && data) {
        customerRecord = data;
      }
    } catch (e) {
      console.warn("DB insert error, using fallback:", e);
    }

    if (!customerRecord) {
      customerRecord = {
        id: `manual_${Date.now()}_${cleanPhone}`,
        ...payload,
      };

      // Save to fallback app_settings
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "vending_customers_data")
          .maybeSingle();
        const existing: any[] = data?.value ? JSON.parse(data.value) : [];
        const idx = existing.findIndex((c) => c.phone === cleanPhone);
        if (idx >= 0) {
          existing[idx] = { ...existing[idx], ...customerRecord };
        } else {
          existing.unshift(customerRecord);
        }
        await supabase.from("app_settings").upsert({
          key: "vending_customers_data",
          value: JSON.stringify(existing.slice(0, 2000)),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
      } catch (_) {}
    }

    return NextResponse.json({ success: true, customer: customerRecord });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to create customer" }, { status: 500 });
  }
}

// ─── PATCH: Update Customer Notes / Details ───
export async function PATCH(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, phone, name, locality, pincode, notes } = body;

    if (!id && !phone) {
      return NextResponse.json({ success: false, error: "Customer id or phone required" }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (locality !== undefined) updates.locality = locality.trim();
    if (pincode !== undefined) updates.pincode = pincode.trim();
    if (notes !== undefined) updates.notes = notes;

    if (id) {
      await supabase.from("customers").update(updates).eq("id", id);
    } else if (phone) {
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      await supabase.from("customers").update(updates).eq("phone", cleanPhone);
    }

    // Also update fallback in app_settings if exists
    try {
      const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "vending_customers_data")
        .maybeSingle();
      if (data?.value) {
        const existing: any[] = JSON.parse(data.value);
        const idx = existing.findIndex((c) => (id && c.id === id) || (cleanPhone && c.phone === cleanPhone));
        if (idx >= 0) {
          existing[idx] = { ...existing[idx], ...updates };
          await supabase.from("app_settings").upsert({
            key: "vending_customers_data",
            value: JSON.stringify(existing),
            updated_at: new Date().toISOString(),
          }, { onConflict: "key" });
        }
      }
    } catch (_) {}

    return NextResponse.json({ success: true, message: "Customer updated successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to update customer" }, { status: 500 });
  }
}

// ─── DELETE: Delete Customer (Single or Bulk) ───
export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    let idsToDelete: string[] = [];
    const idParam = searchParams.get("id");
    const phoneParam = searchParams.get("phone");

    // Check JSON body for bulk ids if present
    try {
      const body = await request.json();
      if (Array.isArray(body.ids)) idsToDelete = body.ids;
    } catch (_) {}

    if (idParam) idsToDelete.push(idParam);

    if (idsToDelete.length === 0 && !phoneParam) {
      return NextResponse.json({ success: false, error: "Missing customer id or phone" }, { status: 400 });
    }

    if (idsToDelete.length > 0) {
      await supabase.from("customers").delete().in("id", idsToDelete);
    }
    if (phoneParam) {
      const cleanPhone = phoneParam.replace(/\D/g, "").slice(-10);
      await supabase.from("customers").delete().eq("phone", cleanPhone);
    }

    // Clean up fallback app_settings
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "vending_customers_data")
        .maybeSingle();
      if (data?.value) {
        let existing: any[] = JSON.parse(data.value);
        existing = existing.filter((c) => !idsToDelete.includes(c.id) && (!phoneParam || c.phone !== phoneParam.replace(/\D/g, "").slice(-10)));
        await supabase.from("app_settings").upsert({
          key: "vending_customers_data",
          value: JSON.stringify(existing),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
      }
    } catch (_) {}

    return NextResponse.json({ success: true, message: "Customer(s) deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to delete" }, { status: 500 });
  }
}
