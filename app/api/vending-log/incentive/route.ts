import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface StaffIncentivePayout {
  id: string;
  payout_date: string; // YYYY-MM-DD
  payout_time?: string; // e.g. "04:30 PM"
  amount: number;
  payment_mode: string; // "Cash" | "UPI" | "Bank Transfer" | string
  recipient_name: string; // e.g. "Counter Staff"
  notes?: string;
  created_at: string;
}

export interface SpecialIncentiveRule {
  date: string; // YYYY-MM-DD
  rate_per_kg: number; // e.g. 20 (instead of default 5)
  label: string; // e.g. "Friday Catch Deal" or "Special Catch Boost"
  deduct_daily_salary?: boolean; // if true, indicates Friday pact applies (0 salary for this day)
  salary_deduction_amount?: number; // e.g. 350
  enabled: boolean;
  notes?: string;
  updated_at?: string;
}

const SETTINGS_KEY = "staff_incentive_payouts";
const SPECIAL_RULES_KEY = "staff_special_incentive_rules";

// Fetch payouts from app_settings
async function getStoredPayouts(): Promise<StaffIncentivePayout[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Error reading staff payouts:", err);
  }
  return [];
}

// Save payouts to app_settings
async function saveStoredPayouts(payouts: StaffIncentivePayout[]): Promise<boolean> {
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: JSON.stringify(payouts),
        description: "Staff gutted trout incentive payout disbursement ledger",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) {
      console.warn("Error saving staff payouts to app_settings:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Exception saving staff payouts:", err);
    return false;
  }
}

// Fetch special daily incentive rules from app_settings
async function getStoredSpecialRules(): Promise<Record<string, SpecialIncentiveRule>> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SPECIAL_RULES_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Error reading special incentive rules:", err);
  }
  return {};
}

// Save special daily incentive rules to app_settings
async function saveStoredSpecialRules(rules: Record<string, SpecialIncentiveRule>): Promise<boolean> {
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: SPECIAL_RULES_KEY,
        value: JSON.stringify(rules),
        description: "Special daily gutted trout incentive rates (e.g. Friday ₹20/Kg deal)",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return !error;
  } catch (err) {
    console.warn("Exception saving special rules:", err);
    return false;
  }
}

// ─── GET: List all recorded payouts + special rules ──────────────────────────
export async function GET(request: Request) {
  try {
    const [payouts, specialRules] = await Promise.all([
      getStoredPayouts(),
      getStoredSpecialRules(),
    ]);

    // Sort descending by date, then created_at
    payouts.sort((a, b) => {
      const d = (b.payout_date || "").localeCompare(a.payout_date || "");
      if (d !== 0) return d;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    return NextResponse.json(
      {
        success: true,
        payouts,
        totalPaid: payouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
        defaultRatePerKg: 5,
        specialRules,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Staff Incentive GET Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST: Record a new payout disbursement OR toggle/save special rule ──────
export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // 1. Action: Save or Toggle Special Incentive Rule (e.g. Friday ₹20/Kg deal)
    if (body.action === "save_special_rule" || body.action === "toggle_friday_deal") {
      const {
        date,
        rate_per_kg,
        label,
        deduct_daily_salary,
        salary_deduction_amount,
        enabled,
        notes,
      } = body;

      if (!date || typeof date !== "string") {
        return NextResponse.json(
          { success: false, error: "A valid date (YYYY-MM-DD) is required for special incentive rule." },
          { status: 400 }
        );
      }

      const numRate = parseFloat(rate_per_kg);
      const targetRate = isNaN(numRate) || numRate <= 0 ? 20 : numRate;
      const isEnabled = enabled !== undefined ? Boolean(enabled) : true;

      const currentRules = await getStoredSpecialRules();
      const updatedRule: SpecialIncentiveRule = {
        date,
        rate_per_kg: targetRate,
        label: label || (targetRate >= 20 ? "Friday Special Catch Deal" : "Custom Day Incentive"),
        deduct_daily_salary: Boolean(deduct_daily_salary),
        salary_deduction_amount: deduct_daily_salary ? (Number(salary_deduction_amount) || 350) : 0,
        enabled: isEnabled,
        notes: (notes || "").trim(),
        updated_at: new Date().toISOString(),
      };

      currentRules[date] = updatedRule;
      await saveStoredSpecialRules(currentRules);

      return NextResponse.json({
        success: true,
        rule: updatedRule,
        specialRules: currentRules,
      });
    }

    // 2. Action: Standard Payout Disbursement Recording
    const { payout_date, payout_time, amount, payment_mode, recipient_name, notes } = body;

    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "A valid payout amount greater than 0 is required." },
        { status: 400 }
      );
    }

    const now = new Date();
    const newPayout: StaffIncentivePayout = {
      id: crypto.randomUUID(),
      payout_date: payout_date || now.toISOString().split("T")[0],
      payout_time:
        payout_time ||
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        }),
      amount: Math.round(numAmount * 100) / 100,
      payment_mode: payment_mode || "Cash",
      recipient_name: (recipient_name || "Mohd Amin").trim(),
      notes: (notes || "").trim(),
      created_at: now.toISOString(),
    };

    const currentList = await getStoredPayouts();
    const updatedList = [newPayout, ...currentList];
    await saveStoredPayouts(updatedList);

    return NextResponse.json({
      success: true,
      payout: newPayout,
      totalPaid: updatedList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    });
  } catch (err: any) {
    console.error("Staff Incentive POST Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE: Remove/Void a payout entry OR special rule ──────────────────────
export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "special_rule") {
      const date = searchParams.get("date");
      if (!date) {
        return NextResponse.json({ success: false, error: "Missing rule date" }, { status: 400 });
      }
      const currentRules = await getStoredSpecialRules();
      delete currentRules[date];
      await saveStoredSpecialRules(currentRules);
      return NextResponse.json({ success: true, specialRules: currentRules });
    }

    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing payout id" }, { status: 400 });
    }

    const currentList = await getStoredPayouts();
    const filtered = currentList.filter((p) => p.id !== id);

    if (filtered.length !== currentList.length) {
      await saveStoredPayouts(filtered);
    }

    return NextResponse.json({
      success: true,
      id,
      totalPaid: filtered.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    });
  } catch (err: any) {
    console.error("Staff Incentive DELETE Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
