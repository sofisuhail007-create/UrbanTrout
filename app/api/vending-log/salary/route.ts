import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface WorkerSalaryPayment {
  id: string;
  worker_name: string; // Default: "Mohd Amin"
  salary_month: string; // e.g. "September 2026"
  payment_date: string; // YYYY-MM-DD
  payment_time?: string; // e.g. "05:00 PM"
  amount: number;
  payment_mode: string; // "Cash" | "UPI" | "Bank Transfer"
  notes?: string;
  created_at: string;
}

export interface WorkerSalaryDeduction {
  id: string;
  worker_name: string; // Default: "Mohd Amin"
  salary_month: string; // e.g. "October 2026"
  date: string; // YYYY-MM-DD
  reason: string; // "Sick Leave" | "Personal Leave" | "Friday Deal Pact (Incentive Only)" | "Unannounced Absence" | string
  days_count: number; // e.g. 1 or 0.5
  daily_rate: number; // e.g. 350
  amount: number; // e.g. 350
  notes?: string;
  created_at: string;
}

export interface WorkerSalarySettings {
  worker_name: string;
  base_monthly_salary: number; // e.g. 10500
}

const SETTINGS_KEY = "worker_salary_ledger";
const CONFIG_KEY = "worker_salary_config";
const DEDUCTIONS_KEY = "worker_salary_deductions";

const DEFAULT_CONFIG: WorkerSalarySettings = {
  worker_name: "Mohd Amin",
  base_monthly_salary: 10500,
};

async function getStoredSalaryPayments(): Promise<WorkerSalaryPayment[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Error reading salary payments:", err);
  }
  return [];
}

async function saveStoredSalaryPayments(payments: WorkerSalaryPayment[]): Promise<boolean> {
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: JSON.stringify(payments),
        description: "Vending center worker salary payment ledger (Mohd Amin)",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) {
      console.warn("Error saving salary payments:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Exception saving salary payments:", err);
    return false;
  }
}

async function getStoredDeductions(): Promise<WorkerSalaryDeduction[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", DEDUCTIONS_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Error reading salary deductions:", err);
  }
  return [];
}

async function saveStoredDeductions(deductions: WorkerSalaryDeduction[]): Promise<boolean> {
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: DEDUCTIONS_KEY,
        value: JSON.stringify(deductions),
        description: "Vending center worker salary deductions ledger (Mohd Amin sick/leave days)",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return !error;
  } catch (err) {
    console.warn("Exception saving salary deductions:", err);
    return false;
  }
}

async function getSalaryConfig(): Promise<WorkerSalarySettings> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();

    if (data?.value) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(data.value) };
    }
  } catch (err) {
    console.warn("Error reading salary config:", err);
  }
  return DEFAULT_CONFIG;
}

async function saveSalaryConfig(cfg: WorkerSalarySettings): Promise<boolean> {
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: CONFIG_KEY,
        value: JSON.stringify(cfg),
        description: "Vending center worker salary configuration (base wage)",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return !error;
  } catch (err) {
    return false;
  }
}

// ─── GET: List all salary payments + deductions + config ─────────────────────
export async function GET(request: Request) {
  try {
    const [payments, deductions, config] = await Promise.all([
      getStoredSalaryPayments(),
      getStoredDeductions(),
      getSalaryConfig(),
    ]);

    payments.sort((a, b) => {
      const d = (b.payment_date || "").localeCompare(a.payment_date || "");
      if (d !== 0) return d;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    deductions.sort((a, b) => {
      const d = (b.date || "").localeCompare(a.date || "");
      if (d !== 0) return d;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    return NextResponse.json(
      {
        success: true,
        payments,
        deductions,
        config,
        totalPaid,
        totalDeductions,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Worker Salary GET Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST: Record a salary disbursement OR leave deduction ──────────────────
export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // 1. Action: Record Leave / Sick Day Deduction
    if (body.action === "record_deduction") {
      const { worker_name, salary_month, date, reason, days_count, daily_rate, notes } = body;

      const numDays = parseFloat(days_count) || 1;
      const config = await getSalaryConfig();
      // Default daily rate: Base salary / 30 (e.g. 10500 / 30 = 350)
      const defaultDailyRate = Math.round((config.base_monthly_salary || 10500) / 30);
      const targetDailyRate = parseFloat(daily_rate) || defaultDailyRate;
      const deductionAmount = Math.round(numDays * targetDailyRate);

      const now = new Date();
      const currentMonthLabel = now.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
      const defaultDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

      const newDeduction: WorkerSalaryDeduction = {
        id: crypto.randomUUID(),
        worker_name: (worker_name || config.worker_name || "Mohd Amin").trim(),
        salary_month: (salary_month || currentMonthLabel).trim(),
        date: date || defaultDate,
        reason: (reason || "Sick Leave").trim(),
        days_count: numDays,
        daily_rate: targetDailyRate,
        amount: deductionAmount,
        notes: (notes || "").trim(),
        created_at: now.toISOString(),
      };

      const currentDeductions = await getStoredDeductions();
      const updatedDeductions = [newDeduction, ...currentDeductions];
      await saveStoredDeductions(updatedDeductions);

      return NextResponse.json({
        success: true,
        deduction: newDeduction,
        deductions: updatedDeductions,
        totalDeductions: updatedDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
      });
    }

    // 2. Action: Standard Salary Payment Disbursement
    const { worker_name, salary_month, payment_date, payment_time, amount, payment_mode, notes } = body;

    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "A valid salary payment amount greater than 0 is required." },
        { status: 400 }
      );
    }

    const now = new Date();
    const currentMonthLabel = now.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
    const defaultDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const defaultTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

    const newPayment: WorkerSalaryPayment = {
      id: crypto.randomUUID(),
      worker_name: (worker_name || "Mohd Amin").trim(),
      salary_month: (salary_month || currentMonthLabel).trim(),
      payment_date: payment_date || defaultDate,
      payment_time: payment_time || defaultTime,
      amount: Math.round(numAmount * 100) / 100,
      payment_mode: payment_mode || "Cash",
      notes: (notes || "").trim(),
      created_at: now.toISOString(),
    };

    const currentList = await getStoredSalaryPayments();
    const updatedList = [newPayment, ...currentList];
    await saveStoredSalaryPayments(updatedList);

    const totalPaid = updatedList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return NextResponse.json({
      success: true,
      payment: newPayment,
      totalPaid,
    });
  } catch (err: any) {
    console.error("Worker Salary POST Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PATCH: Update base salary configuration ────────────────────────────────
export async function PATCH(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { base_monthly_salary, worker_name } = body;

    const current = await getSalaryConfig();
    const updated: WorkerSalarySettings = {
      worker_name: worker_name ? String(worker_name).trim() : current.worker_name,
      base_monthly_salary:
        typeof base_monthly_salary === "number" && base_monthly_salary >= 0
          ? base_monthly_salary
          : current.base_monthly_salary,
    };

    await saveSalaryConfig(updated);

    return NextResponse.json({ success: true, config: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE: Void a salary payment OR deduction ──────────────────────────────
export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing record id" }, { status: 400 });
    }

    // 1. Delete Deduction
    if (type === "deduction") {
      const currentDeductions = await getStoredDeductions();
      const filteredDeductions = currentDeductions.filter((d) => d.id !== id);

      if (filteredDeductions.length !== currentDeductions.length) {
        await saveStoredDeductions(filteredDeductions);
      }

      return NextResponse.json({
        success: true,
        id,
        totalDeductions: filteredDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
      });
    }

    // 2. Delete Salary Payment
    const currentList = await getStoredSalaryPayments();
    const filtered = currentList.filter((p) => p.id !== id);

    if (filtered.length !== currentList.length) {
      await saveStoredSalaryPayments(filtered);
    }

    const totalPaid = filtered.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return NextResponse.json({
      success: true,
      id,
      totalPaid,
    });
  } catch (err: any) {
    console.error("Worker Salary DELETE Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
