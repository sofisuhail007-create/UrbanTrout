import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface OwnerPersonalExpense {
  id: string;
  expense_date: string; // YYYY-MM-DD
  expense_time: string; // e.g. "02:30 pm"
  category:
    | "Food & Dining"
    | "Personal Fuel & Travel"
    | "Family & Home"
    | "Personal Shopping"
    | "Health & Medical"
    | "Personal Utilities"
    | "Cash Drawer Draw"
    | "Other";
  title: string;
  amount: number;
  payment_source: "Cash from Drawer" | "Personal UPI / Bank" | "Other";
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface OwnerWalletConfig {
  monthly_budget_cap: number; // e.g. 25000 (0 means no cap set)
  warning_threshold_pct: number; // e.g. 80 (%)
}

const SETTINGS_KEY_LEDGER = "owner_personal_wallet_ledger";
const SETTINGS_KEY_CONFIG = "owner_wallet_budget_config";

const DEFAULT_CONFIG: OwnerWalletConfig = {
  monthly_budget_cap: 25000,
  warning_threshold_pct: 80,
};

function getIstToday(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch (_) {
    return new Date().toISOString().split("T")[0];
  }
}

function getIstTime(): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date()).toLowerCase();
  } catch (_) {
    return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
}

async function getLedger(): Promise<OwnerPersonalExpense[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY_LEDGER)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Could not read owner_personal_wallet_ledger:", err);
  }
  return [];
}

async function saveLedger(entries: OwnerPersonalExpense[]): Promise<boolean> {
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: SETTINGS_KEY_LEDGER,
        value: JSON.stringify(entries.slice(0, 2000)),
        description: "Owner personal expense drawings ledger (deducted from final profit only)",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return !error;
  } catch (err) {
    console.error("Failed to save owner_personal_wallet_ledger:", err);
    return false;
  }
}

async function getConfig(): Promise<OwnerWalletConfig> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY_CONFIG)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (_) {}
  return DEFAULT_CONFIG;
}

async function saveConfig(config: OwnerWalletConfig): Promise<boolean> {
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: SETTINGS_KEY_CONFIG,
        value: JSON.stringify(config),
        description: "Owner personal wallet budget limit and guard configurations",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return !error;
  } catch (err) {
    console.error("Failed to save owner_wallet_budget_config:", err);
    return false;
  }
}

// GET: fetch personal expenses with optional ?month=YYYY-MM filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM

    const [allEntries, config] = await Promise.all([getLedger(), getConfig()]);

    let filtered = allEntries;
    if (month && month !== "all") {
      filtered = allEntries.filter((e) => e.expense_date.startsWith(month));
    }

    // Sort by date desc, then created_at desc
    filtered.sort((a, b) => {
      const dCompare = b.expense_date.localeCompare(a.expense_date);
      if (dCompare !== 0) return dCompare;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    const totalPersonalSpent = filtered.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return NextResponse.json({
      success: true,
      entries: filtered,
      allCount: allEntries.length,
      filteredCount: filtered.length,
      totalSpent: totalPersonalSpent,
      budgetConfig: config,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Add a new personal expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, amount, category, payment_source, notes, expense_date, expense_time } = body;

    const parsedAmount = Math.round(Number(amount));
    if (!title || !parsedAmount || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid title and positive amount" },
        { status: 400 }
      );
    }

    const currentLedger = await getLedger();
    const newEntry: OwnerPersonalExpense = {
      id: "pe_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6),
      expense_date: expense_date || getIstToday(),
      expense_time: expense_time || getIstTime(),
      category: category || "Other",
      title: String(title).trim(),
      amount: parsedAmount,
      payment_source: payment_source || "Cash from Drawer",
      notes: notes ? String(notes).trim() : undefined,
      created_at: new Date().toISOString(),
    };

    const updated = [newEntry, ...currentLedger];
    const ok = await saveLedger(updated);

    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Failed to persist personal expense to database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      entry: newEntry,
      message: `Logged ₹${parsedAmount.toLocaleString("en-IN")} for ${newEntry.title}`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Update an entry OR update budget config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if updating budget configuration
    if (body.action === "set_budget") {
      const budgetCap = Math.max(0, Math.round(Number(body.monthly_budget_cap) || 0));
      const warnPct = Math.min(100, Math.max(10, Math.round(Number(body.warning_threshold_pct) || 80)));
      const newConfig: OwnerWalletConfig = {
        monthly_budget_cap: budgetCap,
        warning_threshold_pct: warnPct,
      };
      await saveConfig(newConfig);
      return NextResponse.json({ success: true, budgetConfig: newConfig });
    }

    // Otherwise, edit an existing expense entry
    const { id, title, amount, category, payment_source, notes, expense_date } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing entry ID" }, { status: 400 });
    }

    const currentLedger = await getLedger();
    const index = currentLedger.findIndex((e) => e.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 });
    }

    const parsedAmount = Math.round(Number(amount));
    currentLedger[index] = {
      ...currentLedger[index],
      title: title ? String(title).trim() : currentLedger[index].title,
      amount: parsedAmount > 0 ? parsedAmount : currentLedger[index].amount,
      category: category || currentLedger[index].category,
      payment_source: payment_source || currentLedger[index].payment_source,
      notes: notes !== undefined ? String(notes).trim() : currentLedger[index].notes,
      expense_date: expense_date || currentLedger[index].expense_date,
      updated_at: new Date().toISOString(),
    };

    await saveLedger(currentLedger);
    return NextResponse.json({ success: true, entry: currentLedger[index] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Delete an expense by ID
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
    }

    const currentLedger = await getLedger();
    const updated = currentLedger.filter((e) => e.id !== id);
    await saveLedger(updated);

    return NextResponse.json({ success: true, removedId: id, remaining: updated.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
