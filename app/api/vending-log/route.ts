import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface CustomColumnDef {
  id: string;
  name: string;
  type: "text" | "number" | "select";
  options?: string[];
  visible: boolean;
}

export interface VendingSalesEntry {
  id: string;
  entry_date: string; // YYYY-MM-DD
  entry_time: string; // e.g. "11:30 AM"
  weight_kg: number;
  product_type: string; // "Gutted" | "Non Gutted" | string
  rate_per_kg: number;
  expected_amount?: number;
  amount_paid: number;
  discount_amount?: number;
  payment_mode: string; // "J&K Bank Soundbox UPI" | "Cash" | "Razorpay QR" | "Card / POS"
  custom_fields?: Record<string, any>;
  logged_by?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Fallback helper to store/retrieve from app_settings if table not created yet
async function getFallbackEntries(): Promise<VendingSalesEntry[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "vending_log_data")
      .single();
    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (_) {}
  return [];
}

async function saveFallbackEntries(entries: VendingSalesEntry[]) {
  try {
    await supabase.from("app_settings").upsert(
      {
        key: "vending_log_data",
        value: JSON.stringify(entries.slice(0, 1000)), // retain up to 1000 recent entries
        description: "Fallback JSON storage for vending center sales logs",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (err) {
    console.warn("Could not save to fallback app_settings:", err);
  }
}

async function getCustomColumns(): Promise<CustomColumnDef[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "vending_custom_columns")
      .single();
    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (_) {}
  return [];
}

async function saveCustomColumns(cols: CustomColumnDef[]) {
  try {
    await supabase.from("app_settings").upsert(
      {
        key: "vending_custom_columns",
        value: JSON.stringify(cols),
        description: "Schema configuration for dynamic custom columns in Vending Center Logger",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (err) {
    console.warn("Could not save custom columns:", err);
  }
}

// Compute Day, Week, Month KPI summaries
function computeKpis(entries: VendingSalesEntry[]) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Current Week (Monday to Sunday)
  const currentDay = now.getDay(); // 0 is Sun
  const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // Current Month (1st to now)
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const kpis = {
    today: {
      kg: 0,
      revenue: 0,
      expectedRevenue: 0,
      totalLoss: 0,
      count: 0,
      guttedKg: 0,
      nonGuttedKg: 0,
      onlineRevenue: 0,
      onlineCount: 0,
      cashRevenue: 0,
      cashCount: 0,
    },
    week: {
      kg: 0,
      revenue: 0,
      expectedRevenue: 0,
      totalLoss: 0,
      count: 0,
      guttedKg: 0,
      nonGuttedKg: 0,
      onlineRevenue: 0,
      onlineCount: 0,
      cashRevenue: 0,
      cashCount: 0,
    },
    month: {
      kg: 0,
      revenue: 0,
      expectedRevenue: 0,
      totalLoss: 0,
      count: 0,
      guttedKg: 0,
      nonGuttedKg: 0,
      onlineRevenue: 0,
      onlineCount: 0,
      cashRevenue: 0,
      cashCount: 0,
    },
    allTime: {
      kg: 0,
      revenue: 0,
      expectedRevenue: 0,
      totalLoss: 0,
      count: 0,
      onlineRevenue: 0,
      onlineCount: 0,
      cashRevenue: 0,
      cashCount: 0,
    },
    byPaymentMode: {} as Record<string, { kg: number; revenue: number; count: number }>,
  };

  entries.forEach((e) => {
    const weight = Number(e.weight_kg) || 0;
    const amount = Number(e.amount_paid) || 0;
    const rate = Number(e.rate_per_kg) || 0;
    const expected = e.expected_amount !== undefined ? Number(e.expected_amount) : Math.round(weight * rate);
    const loss = Math.max(0, expected - amount);
    const isCash = (e.payment_mode || "").toLowerCase().trim() === "cash";
    const eDate = new Date(e.entry_date);
    const isGutted = (e.product_type || "").toLowerCase().includes("gutted") && !(e.product_type || "").toLowerCase().includes("non");

    // All-time
    kpis.allTime.kg = Math.round((kpis.allTime.kg + weight) * 1000) / 1000;
    kpis.allTime.revenue += amount;
    kpis.allTime.expectedRevenue += expected;
    kpis.allTime.totalLoss += loss;
    kpis.allTime.count += 1;
    if (isCash) {
      kpis.allTime.cashRevenue += amount;
      kpis.allTime.cashCount += 1;
    } else {
      kpis.allTime.onlineRevenue += amount;
      kpis.allTime.onlineCount += 1;
    }

    // Today
    if (e.entry_date === todayStr) {
      kpis.today.kg = Math.round((kpis.today.kg + weight) * 1000) / 1000;
      kpis.today.revenue += amount;
      kpis.today.expectedRevenue += expected;
      kpis.today.totalLoss += loss;
      kpis.today.count += 1;
      if (isGutted) kpis.today.guttedKg = Math.round((kpis.today.guttedKg + weight) * 1000) / 1000;
      else kpis.today.nonGuttedKg = Math.round((kpis.today.nonGuttedKg + weight) * 1000) / 1000;

      if (isCash) {
        kpis.today.cashRevenue += amount;
        kpis.today.cashCount += 1;
      } else {
        kpis.today.onlineRevenue += amount;
        kpis.today.onlineCount += 1;
      }
    }

    // Week
    if (eDate >= monday) {
      kpis.week.kg = Math.round((kpis.week.kg + weight) * 1000) / 1000;
      kpis.week.revenue += amount;
      kpis.week.expectedRevenue += expected;
      kpis.week.totalLoss += loss;
      kpis.week.count += 1;
      if (isGutted) kpis.week.guttedKg = Math.round((kpis.week.guttedKg + weight) * 1000) / 1000;
      else kpis.week.nonGuttedKg = Math.round((kpis.week.nonGuttedKg + weight) * 1000) / 1000;

      if (isCash) {
        kpis.week.cashRevenue += amount;
        kpis.week.cashCount += 1;
      } else {
        kpis.week.onlineRevenue += amount;
        kpis.week.onlineCount += 1;
      }
    }

    // Month
    if (eDate >= firstOfMonth) {
      kpis.month.kg = Math.round((kpis.month.kg + weight) * 1000) / 1000;
      kpis.month.revenue += amount;
      kpis.month.expectedRevenue += expected;
      kpis.month.totalLoss += loss;
      kpis.month.count += 1;
      if (isGutted) kpis.month.guttedKg = Math.round((kpis.month.guttedKg + weight) * 1000) / 1000;
      else kpis.month.nonGuttedKg = Math.round((kpis.month.nonGuttedKg + weight) * 1000) / 1000;

      if (isCash) {
        kpis.month.cashRevenue += amount;
        kpis.month.cashCount += 1;
      } else {
        kpis.month.onlineRevenue += amount;
        kpis.month.onlineCount += 1;
      }
    }

    // Payment Mode
    const mode = e.payment_mode || "Other";
    if (!kpis.byPaymentMode[mode]) {
      kpis.byPaymentMode[mode] = { kg: 0, revenue: 0, count: 0 };
    }
    kpis.byPaymentMode[mode].kg = Math.round((kpis.byPaymentMode[mode].kg + weight) * 1000) / 1000;
    kpis.byPaymentMode[mode].revenue += amount;
    kpis.byPaymentMode[mode].count += 1;
  });

  return kpis;
}

// ─── GET: Fetch entries, KPIs, and custom column definitions ─────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let entries: VendingSalesEntry[] = [];
    let isTableAvailable = true;

    // Try primary Supabase table
    try {
      let query = supabase
        .from("vending_sales_log")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (startDate) query = query.gte("entry_date", startDate);
      if (endDate) query = query.lte("entry_date", endDate);

      const { data, error } = await query;
      if (error) throw error;
      entries = (data as VendingSalesEntry[]) || [];
    } catch (err: any) {
      // Table doesn't exist yet or permission fallback
      isTableAvailable = false;
      const allFallback = await getFallbackEntries();
      entries = allFallback;
      if (startDate) entries = entries.filter((e) => e.entry_date >= startDate);
      if (endDate) entries = entries.filter((e) => e.entry_date <= endDate);
    }

    const customColumns = await getCustomColumns();
    const kpis = computeKpis(entries);

    return NextResponse.json({
      success: true,
      entries,
      kpis,
      customColumns,
      isTableAvailable,
    });
  } catch (err: any) {
    console.error("Vending Log GET Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST: Add New Sales Log Entry ───────────────────────────────────────────
export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      entry_date,
      entry_time,
      weight_kg,
      product_type,
      rate_per_kg,
      amount_paid,
      payment_mode,
      custom_fields,
      logged_by,
      notes,
    } = body;

    if (!weight_kg || !amount_paid) {
      return NextResponse.json(
        { success: false, error: "Weight and Amount Paid are required." },
        { status: 400 }
      );
    }

    const parsedWeight = parseFloat(weight_kg);
    const parsedRate = parseFloat(rate_per_kg) || 650;
    const parsedPaid = parseFloat(amount_paid);
    const calculatedExpected = Math.round(parsedWeight * parsedRate);
    const expected = body.expected_amount !== undefined && body.expected_amount !== null
      ? parseFloat(body.expected_amount)
      : calculatedExpected;
    const discount = Math.max(0, expected - parsedPaid);

    const now = new Date();
    const entry: VendingSalesEntry = {
      id: crypto.randomUUID(),
      entry_date: entry_date || now.toISOString().split("T")[0],
      entry_time:
        entry_time ||
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      weight_kg: parsedWeight,
      product_type: product_type || "Gutted",
      rate_per_kg: parsedRate,
      expected_amount: expected,
      amount_paid: parsedPaid,
      discount_amount: discount,
      payment_mode: payment_mode || "J&K Bank Soundbox UPI",
      custom_fields: custom_fields || {},
      logged_by: logged_by || "Counter Staff",
      notes: notes || "",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    // Try Supabase table insert
    let savedInTable = false;
    try {
      const { data, error } = await supabase
        .from("vending_sales_log")
        .insert([entry])
        .select()
        .single();
      if (!error && data) {
        savedInTable = true;
      }
    } catch (_) {}

    // Always ensure fallback storage has copy if table isn't ready
    if (!savedInTable) {
      const fallbackList = await getFallbackEntries();
      fallbackList.unshift(entry);
      await saveFallbackEntries(fallbackList);
    }

    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
    console.error("Vending Log POST Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PUT: Update an existing Sales Log Entry ─────────────────────────────────
export async function PUT(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json({ success: false, error: "Missing id or updates" }, { status: 400 });
    }

    if (updates.weight_kg !== undefined && updates.rate_per_kg !== undefined) {
      const w = parseFloat(updates.weight_kg);
      const r = parseFloat(updates.rate_per_kg);
      const paid = updates.amount_paid !== undefined ? parseFloat(updates.amount_paid) : 0;
      updates.expected_amount = updates.expected_amount !== undefined ? parseFloat(updates.expected_amount) : Math.round(w * r);
      updates.discount_amount = Math.max(0, updates.expected_amount - paid);
    }

    updates.updated_at = new Date().toISOString();

    // Try Supabase table update
    let updatedInTable = false;
    try {
      const { error } = await supabase
        .from("vending_sales_log")
        .update(updates)
        .eq("id", id);
      if (!error) updatedInTable = true;
    } catch (_) {}

    // Fallback sync
    const fallbackList = await getFallbackEntries();
    const idx = fallbackList.findIndex((e) => e.id === id);
    if (idx !== -1) {
      fallbackList[idx] = { ...fallbackList[idx], ...updates };
      await saveFallbackEntries(fallbackList);
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Vending Log PUT Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE: Delete a Sales Log Entry ───────────────────────────────────────
export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    try {
      await supabase.from("vending_sales_log").delete().eq("id", id);
    } catch (_) {}

    const fallbackList = await getFallbackEntries();
    const filtered = fallbackList.filter((e) => e.id !== id);
    if (filtered.length !== fallbackList.length) {
      await saveFallbackEntries(filtered);
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Vending Log DELETE Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PATCH: Manage Custom Columns ───────────────────────────────────────────
export async function PATCH(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { customColumns } = body;

    if (!Array.isArray(customColumns)) {
      return NextResponse.json({ success: false, error: "customColumns must be an array" }, { status: 400 });
    }

    await saveCustomColumns(customColumns);
    return NextResponse.json({ success: true, customColumns });
  } catch (err: any) {
    console.error("Vending Log PATCH Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
