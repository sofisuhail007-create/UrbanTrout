import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ─── KHYBER AQUACULTURE SLAB STRUCTURE ───
// Base Procurement Price: ₹410 / Kg
// Transportation: ₹25 / Kg (Fixed, not subject to rebate)
// Standard Invoice Rate: ₹435 / Kg
export interface RebateSlab {
  tier: number;
  name: string;
  minKg: number;
  maxKg: number | null;
  rebatePerKg: number;
  effectiveBaseRate: number;
  effectiveDeliveredRate: number;
  description: string;
}

export const KHYBER_SLABS: RebateSlab[] = [
  {
    tier: 1,
    name: "Tier 1 (Base)",
    minKg: 0,
    maxKg: 299.999,
    rebatePerKg: 0,
    effectiveBaseRate: 410,
    effectiveDeliveredRate: 435,
    description: "Standard base procurement slab without volume rebate.",
  },
  {
    tier: 2,
    name: "Tier 2 (Bronze)",
    minKg: 300,
    maxKg: 500,
    rebatePerKg: 10,
    effectiveBaseRate: 400,
    effectiveDeliveredRate: 425,
    description: "₹10/Kg rebate unlocked across all lifted kilograms.",
  },
  {
    tier: 3,
    name: "Tier 3 (Silver)",
    minKg: 501,
    maxKg: 1000,
    rebatePerKg: 20,
    effectiveBaseRate: 390,
    effectiveDeliveredRate: 415,
    description: "₹20/Kg rebate unlocked across all lifted kilograms.",
  },
  {
    tier: 4,
    name: "Tier 4 (Gold)",
    minKg: 1001,
    maxKg: 1500,
    rebatePerKg: 30,
    effectiveBaseRate: 380,
    effectiveDeliveredRate: 405,
    description: "₹30/Kg rebate unlocked across all lifted kilograms.",
  },
  {
    tier: 5,
    name: "Tier 5 (Platinum)",
    minKg: 1500.001,
    maxKg: null,
    rebatePerKg: 35,
    effectiveBaseRate: 375,
    effectiveDeliveredRate: 400,
    description: "Maximum ₹35/Kg rebate unlocked across all lifted kilograms.",
  },
];

export function calculateSlabForVolume(kg: number) {
  let currentSlab = KHYBER_SLABS[0];
  let nextSlab: RebateSlab | null = KHYBER_SLABS[1];
  let targetNextKg = 300;

  if (kg >= 1500) {
    currentSlab = KHYBER_SLABS[4];
    nextSlab = null;
    targetNextKg = 1500;
  } else if (kg >= 1001) {
    currentSlab = KHYBER_SLABS[3];
    nextSlab = KHYBER_SLABS[4];
    targetNextKg = 1500;
  } else if (kg >= 501) {
    currentSlab = KHYBER_SLABS[2];
    nextSlab = KHYBER_SLABS[3];
    targetNextKg = 1001;
  } else if (kg >= 300) {
    currentSlab = KHYBER_SLABS[1];
    nextSlab = KHYBER_SLABS[2];
    targetNextKg = 501;
  } else {
    currentSlab = KHYBER_SLABS[0];
    nextSlab = KHYBER_SLABS[1];
    targetNextKg = 300;
  }

  const kgToNext = nextSlab ? Math.max(0, Math.round((targetNextKg - kg) * 1000) / 1000) : 0;
  const rebateEarned = Math.round(kg * currentSlab.rebatePerKg);
  const potentialNextRebate = nextSlab ? Math.round(targetNextKg * nextSlab.rebatePerKg) : 0;
  const incrementalGain = nextSlab ? Math.max(0, potentialNextRebate - rebateEarned) : 0;
  const progressPercent = nextSlab
    ? Math.min(100, Math.round((kg / targetNextKg) * 1000) / 10)
    : 100;

  return {
    currentSlab,
    nextSlab,
    targetNextKg,
    kgToNext,
    rebateEarned,
    potentialNextRebate,
    incrementalGain,
    progressPercent,
  };
}

export interface CreditDeduction {
  id: string;
  date: string;
  amount: number;
  batch_id?: string;
  notes?: string;
  logged_by?: string;
  created_at: string;
}

export interface MonthRebateSummary {
  monthKey: string;
  monthLabel: string;
  totalKg: number;
  batchCount: number;
  totalCostPaid: number;
  effectiveTotalCost: number;
  rebateEarned: number;
  effectiveBaseRate: number;
  effectiveDeliveredRate: number;
  currentSlab: RebateSlab;
  nextSlab: RebateSlab | null;
  targetNextKg: number;
  kgToNext: number;
  potentialNextRebate: number;
  incrementalGain: number;
  progressPercent: number;
  batches: any[];
}

const SETTINGS_KEY = "khyber_rebate_credits";

async function getCreditLedger(): Promise<{ deductions: CreditDeduction[]; notes?: string }> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      return {
        deductions: Array.isArray(parsed.deductions) ? parsed.deductions : [],
        notes: parsed.notes || "",
      };
    }
  } catch (e) {
    console.warn("Failed to load khyber_rebate_credits:", e);
  }
  return { deductions: [] };
}

async function saveCreditLedger(payload: { deductions: CreditDeduction[]; notes?: string }) {
  await supabaseAdmin.from("app_settings").upsert(
    {
      key: SETTINGS_KEY,
      value: JSON.stringify(payload),
      description: "Ledger of Khyber Aquaculture volume rebate credits and batch deductions",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
}

function formatMonthLabel(mKey: string): string {
  try {
    const [y, m] = mKey.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
  } catch {
    return mKey;
  }
}

// ─── GET: Fetch Khyber Slabs, Monthly Progress & Credit Ledger ───
export async function GET(req: NextRequest) {
  try {
    const authError = await requireAdminAuth(req);
    if (authError) return authError;

    // Fetch all stock logs
    const { data: rawBatches, error } = await supabaseAdmin
      .from("aquarium_stock_log")
      .select("*")
      .order("stock_date", { ascending: false });

    if (error && !error.message?.includes("does not exist")) {
      throw error;
    }

    const batches = rawBatches || [];
    // Filter Khyber batches (or treat all live batches as Khyber since Khyber is the sole live trout farm source)
    const khyberBatches = batches.filter(
      (b) =>
        !b.supplier_name ||
        b.supplier_name.toLowerCase().includes("khyber") ||
        b.supplier_name.toLowerCase().includes("aquaculture")
    );

    // Group batches by YYYY-MM
    const monthlyMap: Record<string, any[]> = {};
    khyberBatches.forEach((b) => {
      const mKey = (b.stock_date || "").slice(0, 7);
      if (!mKey || mKey.length < 7) return;
      if (!monthlyMap[mKey]) monthlyMap[mKey] = [];
      monthlyMap[mKey].push(b);
    });

    // Ensure current month exists even if no batches logged yet
    const currMonthKey = new Date().toISOString().slice(0, 7);
    if (!monthlyMap[currMonthKey]) {
      monthlyMap[currMonthKey] = [];
    }

    const monthlySummaries: Record<string, MonthRebateSummary> = {};
    let totalEarnedCreditsAllTime = 0;

    Object.keys(monthlyMap).forEach((mKey) => {
      const monthBatches = monthlyMap[mKey];
      let totalKg = 0;
      let totalCostPaid = 0;

      monthBatches.forEach((b) => {
        const w = Number(b.weight_kg) || 0;
        const c = Number(b.cost_per_kg) || 435;
        const tot = Number(b.total_cost) || w * c;
        totalKg = Math.round((totalKg + w) * 1000) / 1000;
        totalCostPaid += tot;
      });

      const calc = calculateSlabForVolume(totalKg);
      totalEarnedCreditsAllTime += calc.rebateEarned;

      monthlySummaries[mKey] = {
        monthKey: mKey,
        monthLabel: formatMonthLabel(mKey),
        totalKg,
        batchCount: monthBatches.length,
        totalCostPaid: Math.round(totalCostPaid),
        effectiveTotalCost: Math.round(totalCostPaid - calc.rebateEarned),
        rebateEarned: calc.rebateEarned,
        effectiveBaseRate: calc.currentSlab.effectiveBaseRate,
        effectiveDeliveredRate: calc.currentSlab.effectiveDeliveredRate,
        currentSlab: calc.currentSlab,
        nextSlab: calc.nextSlab,
        targetNextKg: calc.targetNextKg,
        kgToNext: calc.kgToNext,
        potentialNextRebate: calc.potentialNextRebate,
        incrementalGain: calc.incrementalGain,
        progressPercent: calc.progressPercent,
        batches: monthBatches,
      };
    });

    // Fetch credit deductions ledger
    const creditLedger = await getCreditLedger();
    const totalDeductedCredits = creditLedger.deductions.reduce(
      (sum, d) => sum + (Number(d.amount) || 0),
      0
    );
    const availableCreditBalance = Math.round(totalEarnedCreditsAllTime - totalDeductedCredits);

    return NextResponse.json({
      success: true,
      supplier: {
        name: "Khyber Aquaculture",
        tagline: "Live Trout Primary Supplier",
        contactPerson: "Syed Ihtsham Qadri / Ubaid (Sales ERP)",
        baseRatePerKg: 410,
        transportRatePerKg: 25,
        standardBilledRatePerKg: 435,
        rebateModel: "Monthly Cumulative Lift Slab Rebate (Credited to Supplier Ledger)",
      },
      slabs: KHYBER_SLABS,
      monthlySummaries,
      activeMonthKey: currMonthKey,
      creditLedger: {
        availableCreditBalance,
        totalEarnedCreditsAllTime,
        totalDeductedCredits,
        deductions: creditLedger.deductions,
      },
    });
  } catch (err: any) {
    console.error("Supplier Rebate API Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load supplier rebates" },
      { status: 500 }
    );
  }
}

// ─── POST: Manage Credit Deductions & Settlements ───
export async function POST(req: NextRequest) {
  try {
    const authError = await requireAdminAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const { action } = body;

    const ledger = await getCreditLedger();

    if (action === "deduct_credit") {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { success: false, error: "Valid deduction amount required" },
          { status: 400 }
        );
      }

      const newDeduction: CreditDeduction = {
        id: `ded_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: body.date || new Date().toISOString().slice(0, 10),
        amount,
        batch_id: body.batch_id || undefined,
        notes: body.notes || "Deducted against stock batch payment",
        logged_by: body.logged_by || "Admin",
        created_at: new Date().toISOString(),
      };

      ledger.deductions.unshift(newDeduction);
      await saveCreditLedger(ledger);

      return NextResponse.json({
        success: true,
        message: `Recorded deduction of ₹${amount.toLocaleString("en-IN")}`,
        deduction: newDeduction,
      });
    }

    if (action === "delete_deduction") {
      const id = body.id;
      if (!id) {
        return NextResponse.json(
          { success: false, error: "Deduction ID required" },
          { status: 400 }
        );
      }

      ledger.deductions = ledger.deductions.filter((d) => d.id !== id);
      await saveCreditLedger(ledger);

      return NextResponse.json({
        success: true,
        message: "Deduction removed successfully",
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Supplier Rebate POST Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Operation failed" },
      { status: 500 }
    );
  }
}
