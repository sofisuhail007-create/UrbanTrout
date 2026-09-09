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

const SETTINGS_KEY = "staff_incentive_payouts";

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

// ─── GET: List all recorded payouts ──────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const payouts = await getStoredPayouts();
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

// ─── POST: Record a new payout disbursement ──────────────────────────────────
export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
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
        }),
      amount: Math.round(numAmount * 100) / 100,
      payment_mode: payment_mode || "Cash",
      recipient_name: (recipient_name || "Counter Staff").trim(),
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

// ─── DELETE: Remove/Void a payout entry ──────────────────────────────────────
export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
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
