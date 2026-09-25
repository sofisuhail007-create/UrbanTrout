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

    // Helper to get precise timestamp from vending entry
    function getVendingTimestamp(v: any): string {
      if (v.created_at && !v.created_at.endsWith("T00:00:00.000Z") && !v.created_at.endsWith("T00:00:00Z")) {
        return v.created_at;
      }
      if (v.entry_date && v.entry_time) {
        try {
          const timeStr = String(v.entry_time).trim();
          const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
          if (match) {
            let hours = parseInt(match[1], 10);
            const mins = parseInt(match[2], 10);
            const secs = match[3] ? parseInt(match[3], 10) : 0;
            const modifier = (match[4] || "").toLowerCase();
            if (modifier === "pm" && hours < 12) hours += 12;
            if (modifier === "am" && hours === 12) hours = 0;
            
            const hh = String(hours).padStart(2, "0");
            const mm = String(mins).padStart(2, "0");
            const ss = String(secs).padStart(2, "0");
            const iso = `${v.entry_date}T${hh}:${mm}:${ss}+05:30`;
            const parsed = new Date(iso);
            if (!isNaN(parsed.getTime())) {
              return parsed.toISOString();
            }
          }
        } catch (_) {}
      }
      if (v.created_at) return v.created_at;
      if (v.entry_date) return new Date(v.entry_date).toISOString();
      return new Date().toISOString();
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
      const date = getVendingTimestamp(v);

      if (customerMap.has(cleanPhone)) {
        const existing = customerMap.get(cleanPhone);
        if (name && (!existing.name || existing.name === "Customer" || existing.name === "Counter Customer")) {
          existing.name = name;
        }
        // Update last_order_at if this entry is newer
        const existingOrderTime = existing.last_order_at ? new Date(existing.last_order_at).getTime() : 0;
        const entryTime = new Date(date).getTime();
        if (entryTime > existingOrderTime) {
          existing.last_order_at = date;
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

    const getCustomerLatestTimestamp = (c: any): number => {
      const orderTime = c.last_order_at ? new Date(c.last_order_at).getTime() : 0;
      const createdTime = c.created_at ? new Date(c.created_at).getTime() : 0;
      return Math.max(isNaN(orderTime) ? 0 : orderTime, isNaN(createdTime) ? 0 : createdTime);
    };

    const customers = Array.from(customerMap.values()).sort((a, b) => {
      const timeA = getCustomerLatestTimestamp(a);
      const timeB = getCustomerLatestTimestamp(b);
      if (timeB !== timeA) return timeB - timeA;
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdB - createdA;
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
    const { id, phone, originalPhone, name, locality, pincode, notes, total_orders, total_spent, last_order_at } = body;

    const currentPhone = (originalPhone || phone || "").replace(/\D/g, "").slice(-10);
    const newPhone = (phone || originalPhone || "").replace(/\D/g, "").slice(-10);

    if (!id && !currentPhone && !newPhone) {
      return NextResponse.json({ success: false, error: "Customer id or phone required" }, { status: 400 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (locality !== undefined) updates.locality = locality.trim();
    if (pincode !== undefined) updates.pincode = pincode.trim();
    if (notes !== undefined) updates.notes = notes;
    if (newPhone) updates.phone = newPhone;

    // 1. Try updating / upserting into Supabase `customers` table
    try {
      const isUuid = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      
      let existingDbRow = null;
      if (isUuid) {
        const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
        existingDbRow = data;
      }
      if (!existingDbRow && currentPhone) {
        const { data } = await supabase.from("customers").select("*").eq("phone", currentPhone).maybeSingle();
        existingDbRow = data;
      }
      if (!existingDbRow && newPhone) {
        const { data } = await supabase.from("customers").select("*").eq("phone", newPhone).maybeSingle();
        existingDbRow = data;
      }

      if (existingDbRow) {
        await supabase.from("customers").update(updates).eq("id", existingDbRow.id);
      } else {
        await supabase.from("customers").upsert({
          phone: newPhone || currentPhone,
          name: updates.name || "Customer",
          locality: updates.locality || "Srinagar",
          pincode: updates.pincode || "190001",
          notes: updates.notes !== undefined ? updates.notes : "",
          total_orders: Number(total_orders) || 1,
          total_spent: Number(total_spent) || 0,
          last_order_at: last_order_at || new Date().toISOString(),
          created_at: new Date().toISOString(),
        }, { onConflict: "phone" });
      }
    } catch (dbErr) {
      console.warn("[customers PATCH] DB update warning:", dbErr);
    }

    // 2. Update fallback `vending_customers_data` in app_settings
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "vending_customers_data")
        .maybeSingle();

      let existingList: any[] = data?.value ? JSON.parse(data.value) : [];
      const matchIndex = existingList.findIndex(
        (c) =>
          (id && c.id === id) ||
          (currentPhone && c.phone === currentPhone) ||
          (newPhone && c.phone === newPhone)
      );

      if (matchIndex >= 0) {
        existingList[matchIndex] = {
          ...existingList[matchIndex],
          ...updates,
          phone: newPhone || existingList[matchIndex].phone,
          updated_at: new Date().toISOString(),
        };
      } else {
        existingList.unshift({
          id: id && !id.startsWith("vlog_") ? id : `vc_${Date.now()}_${newPhone || currentPhone}`,
          phone: newPhone || currentPhone,
          name: updates.name || "Customer",
          locality: updates.locality || "Srinagar (Counter)",
          pincode: updates.pincode || "190001",
          notes: updates.notes !== undefined ? updates.notes : "[Vending Counter]",
          total_orders: Number(total_orders) || 1,
          total_spent: Number(total_spent) || 0,
          last_order_at: last_order_at || new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source: "vending_counter",
        });
      }

      await supabase.from("app_settings").upsert(
        {
          key: "vending_customers_data",
          value: JSON.stringify(existingList.slice(0, 2000)),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    } catch (fallbackErr) {
      console.warn("[customers PATCH] Fallback update warning:", fallbackErr);
    }

    // 3. If name or phone changed, update customer name/phone in vending_log_data entries as well
    if (updates.name || (newPhone && newPhone !== currentPhone)) {
      try {
        const { data: vLogData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "vending_log_data")
          .maybeSingle();

        if (vLogData?.value) {
          let vLogs: any[] = JSON.parse(vLogData.value);
          let modified = false;
          for (const entry of vLogs) {
            const cf = entry.custom_fields || {};
            const ePhone = String(cf.customer_phone || entry.customer_phone || "").replace(/\D/g, "").slice(-10);
            if (ePhone && (ePhone === currentPhone || ePhone === newPhone)) {
              if (updates.name) {
                cf.customer_name = updates.name;
                if (entry.customer_name) entry.customer_name = updates.name;
              }
              if (newPhone && newPhone !== currentPhone) {
                cf.customer_phone = newPhone;
                if (entry.customer_phone) entry.customer_phone = newPhone;
              }
              entry.custom_fields = cf;
              modified = true;
            }
          }
          if (modified) {
            await supabase.from("app_settings").upsert(
              {
                key: "vending_log_data",
                value: JSON.stringify(vLogs),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "key" }
            );
          }
        }
      } catch (vendLogErr) {
        console.warn("[customers PATCH] vending_log update warning:", vendLogErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Customer updated successfully",
      customer: {
        id: id || `vc_${Date.now()}_${newPhone || currentPhone}`,
        phone: newPhone || currentPhone,
        name: updates.name,
        locality: updates.locality,
        pincode: updates.pincode,
        notes: updates.notes,
      },
    });
  } catch (err: any) {
    console.error("[customers PATCH] error:", err);
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
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const validUuids = idsToDelete.filter((id) => uuidRegex.test(id));
      if (validUuids.length > 0) {
        await supabase.from("customers").delete().in("id", validUuids);
      }
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
