import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";
import { recordAuditLog, resolveActorFromRequest } from "@/lib/auditLog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ROOT_OWNER_EMAILS = ["sofisuhail007@gmail.com", "info.urbantrout@gmail.com"];

export interface VendingExpenseEntry {
  id: string;
  expense_date: string; // YYYY-MM-DD
  expense_time: string; // e.g. "11:30 AM"
  category: string; // 'Ice & Cold Storage', 'Packaging & Bags', 'Cleaning & Sanitation', etc.
  title: string;
  amount: number;
  payment_mode: string; // 'Cash' | 'UPI' | 'Other'
  logged_by: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

// Canonical Indian Standard Time date helper
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

// Canonical Indian Standard Time time helper
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

// Fallback storage in app_settings (key: vending_expenses_data)
async function getFallbackExpenses(): Promise<VendingExpenseEntry[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "vending_expenses_data")
      .maybeSingle();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

async function saveFallbackExpenses(expenses: VendingExpenseEntry[]) {
  try {
    await supabase.from("app_settings").upsert(
      {
        key: "vending_expenses_data",
        value: JSON.stringify(expenses.slice(0, 1000)),
        description: "Fallback JSON storage for vending center operational expenses",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (err) {
    console.warn("Could not save to fallback app_settings vending_expenses_data:", err);
  }
}

// Helper to check if requester is Super Admin / Owner vs Staff
async function checkIsAdmin(request: Request): Promise<{ isAdmin: boolean; userEmail: string | null }> {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const bearerToken = authHeader.substring(7).trim();
      const { data: { user } } = await supabase.auth.getUser(bearerToken);
      if (user?.email) {
        const userEmail = user.email.toLowerCase().trim();
        if (ROOT_OWNER_EMAILS.includes(userEmail)) {
          return { isAdmin: true, userEmail };
        }
        // Check staff_permissions in DB
        const { data: staffRow } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "staff_permissions")
          .maybeSingle();

        if (staffRow?.value) {
          const list = JSON.parse(staffRow.value);
          const member = Array.isArray(list) ? list.find((s: any) => s.email?.toLowerCase().trim() === userEmail) : null;
          if (member) {
            const role = (member.role || "").toLowerCase().trim();
            const isAdminRole = role === "super_admin" || role === "admin";
            return { isAdmin: isAdminRole, userEmail };
          }
        }
        return { isAdmin: false, userEmail };
      }
    }
  } catch (_) {}
  return { isAdmin: false, userEmail: null };
}

// ─── GET: Fetch all expenses ────────────────────────────────────────────────
export async function GET(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { data, error } = await supabase
      .from("vending_expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      // Table doesn't exist yet or cache error — fallback to app_settings
      const fallbackList = await getFallbackExpenses();
      return NextResponse.json({
        success: true,
        entries: fallbackList,
        expenses: fallbackList,
        isTableAvailable: false,
      });
    }

    return NextResponse.json({
      success: true,
      entries: data || [],
      expenses: data || [],
      isTableAvailable: true,
    });
  } catch (err: any) {
    console.error("Vending Expenses GET Error:", err);
    const fallbackList = await getFallbackExpenses();
    return NextResponse.json({
      success: true,
      entries: fallbackList,
      expenses: fallbackList,
      isTableAvailable: false,
    });
  }
}

// ─── POST: Add an Expense ───────────────────────────────────────────────────
export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      expense_date,
      expense_time,
      category,
      title,
      amount,
      payment_mode,
      logged_by,
      notes,
    } = body;

    if (!title || !category || amount === undefined || isNaN(parseFloat(amount))) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: category, title, or valid amount" },
        { status: 400 }
      );
    }

    const numAmount = Math.round(parseFloat(amount) * 100) / 100;
    if (numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Expense amount must be greater than ₹0" },
        { status: 400 }
      );
    }

    const newExpense: VendingExpenseEntry = {
      id: crypto.randomUUID(),
      expense_date: expense_date || getIstToday(),
      expense_time: expense_time || getIstTime(),
      category: category.trim(),
      title: title.trim(),
      amount: numAmount,
      payment_mode: payment_mode || "Cash",
      logged_by: logged_by || "Staff",
      notes: notes || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let tableSaved = false;
    try {
      const { error: insErr } = await supabase.from("vending_expenses").insert(newExpense);
      if (!insErr) tableSaved = true;
    } catch (_) {}

    // Fallback sync
    try {
      const fallbackList = await getFallbackExpenses();
      fallbackList.unshift(newExpense);
      await saveFallbackExpenses(fallbackList);
    } catch (_) {}

    // Audit Log: Record expense creation
    try {
      const actor = await resolveActorFromRequest(request, logged_by);
      await recordAuditLog({
        action: "CREATE_EXPENSE",
        entity_type: "vending_expense",
        entity_id: newExpense.id,
        actor_name: actor.actor_name,
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
        summary: `Logged expense ₹${numAmount} [${newExpense.category} - ${newExpense.title}] (${newExpense.payment_mode})`,
        new_snapshot: newExpense,
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      entry: newExpense,
      expense: newExpense,
      tableSaved,
    });
  } catch (err: any) {
    console.error("Vending Expenses POST Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PUT: Update an Expense ─────────────────────────────────────────────────
export async function PUT(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const { isAdmin } = await checkIsAdmin(request);
  const istToday = getIstToday();

  try {
    const body = await request.json();
    const id = body.id;
    const rawUpdates = body.updates || body;
    const updates = { ...rawUpdates };
    delete updates.id;

    if (!id || Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "Missing id or updates" }, { status: 400 });
    }

    // Restriction: Staff can ONLY edit entries of today!
    if (!isAdmin) {
      let existingDate: string | null = null;
      try {
        const { data: row } = await supabase
          .from("vending_expenses")
          .select("expense_date")
          .eq("id", id)
          .maybeSingle();
        if (row?.expense_date) existingDate = row.expense_date;
      } catch (_) {}

      if (!existingDate) {
        const fallbackList = await getFallbackExpenses();
        const match = fallbackList.find((e) => e.id === id);
        if (match) existingDate = match.expense_date;
      }

      if (existingDate && existingDate !== istToday) {
        return NextResponse.json(
          {
            success: false,
            error: "Access denied: Staff can only edit today's expenses. Contact Super Admin to edit previous expenses.",
          },
          { status: 403 }
        );
      }

      if (updates.expense_date && updates.expense_date !== istToday) {
        return NextResponse.json(
          {
            success: false,
            error: "Access denied: Staff cannot change expense date to a past date.",
          },
          { status: 403 }
        );
      }
    }

    if (updates.amount !== undefined) {
      updates.amount = Math.round(parseFloat(updates.amount) * 100) / 100;
    }
    updates.updated_at = new Date().toISOString();

    let updatedRow: any = null;
    try {
      const { data: updated } = await supabase.from("vending_expenses").update(updates).eq("id", id).select().maybeSingle();
      if (updated) updatedRow = updated;
    } catch (_) {}

    try {
      const fallbackList = await getFallbackExpenses();
      const idx = fallbackList.findIndex((e) => e.id === id);
      if (idx !== -1) {
        fallbackList[idx] = { ...fallbackList[idx], ...updates };
        if (!updatedRow) updatedRow = fallbackList[idx];
        await saveFallbackExpenses(fallbackList);
      }
    } catch (_) {}

    const finalExpense = updatedRow || { id, ...updates };

    // Audit Log: Record expense update
    try {
      const actor = await resolveActorFromRequest(request, updates.logged_by);
      await recordAuditLog({
        action: "UPDATE_EXPENSE",
        entity_type: "vending_expense",
        entity_id: id,
        actor_name: actor.actor_name,
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
        summary: `Modified expense: ${finalExpense.title || "Expense"} (₹${finalExpense.amount || 0})`,
        new_snapshot: finalExpense,
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      id,
      updates,
      entry: finalExpense,
      expense: finalExpense,
    });
  } catch (err: any) {
    console.error("Vending Expenses PUT Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE: Delete an Expense ──────────────────────────────────────────────
export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const { isAdmin } = await checkIsAdmin(request);
  const istToday = getIstToday();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    // Restriction: Staff can ONLY delete entries of today!
    let existingItem: any = null;
    try {
      const { data: row } = await supabase
        .from("vending_expenses")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (row) existingItem = row;
    } catch (_) {}

    if (!existingItem) {
      const fallbackList = await getFallbackExpenses();
      const match = fallbackList.find((e) => e.id === id);
      if (match) existingItem = match;
    }

    if (!isAdmin) {
      const existingDate = existingItem?.expense_date || null;
      if (existingDate && existingDate !== istToday) {
        return NextResponse.json(
          {
            success: false,
            error: "Access denied: Staff can only delete today's expenses. Contact Super Admin to remove previous logs.",
          },
          { status: 403 }
        );
      }
    }

    try {
      await supabase.from("vending_expenses").delete().eq("id", id);
    } catch (_) {}

    try {
      const fallbackList = await getFallbackExpenses();
      const filtered = fallbackList.filter((e) => e.id !== id);
      if (filtered.length !== fallbackList.length) {
        await saveFallbackExpenses(filtered);
      }
    } catch (_) {}

    // Audit Log: Record expense deletion
    try {
      const actor = await resolveActorFromRequest(request);
      await recordAuditLog({
        action: "DELETE_EXPENSE",
        entity_type: "vending_expense",
        entity_id: id,
        actor_name: actor.actor_name,
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
        summary: `Deleted expense #${id.slice(0, 8)}: ₹${existingItem?.amount || 0} [${existingItem?.category || ""} - ${existingItem?.title || ""}]`,
        previous_snapshot: existingItem,
      });
    } catch (_) {}

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Vending Expenses DELETE Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
