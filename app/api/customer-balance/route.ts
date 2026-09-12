import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface CustomerBalanceRecord {
  id: string;
  invoice_id: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: "pending" | "settled" | "waived_final";
  payment_method?: string;
  settlement_note?: string;
  items_summary?: string;
  razorpay_payment_link_id?: string;
  razorpay_payment_link_url?: string;
  razorpay_qr_id?: string;
  last_reminder_sent_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Fallback helper to store/retrieve from app_settings if customer_balances table is not yet created
async function getFallbackBalances(): Promise<CustomerBalanceRecord[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "customer_balances_data")
      .single();
    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (_) {}
  return [];
}

async function saveFallbackBalances(records: CustomerBalanceRecord[]) {
  try {
    await supabase.from("app_settings").upsert(
      {
        key: "customer_balances_data",
        value: JSON.stringify(records.slice(0, 1000)),
        description: "Fallback JSON storage for customer balances and khata ledger",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (err) {
    console.warn("Could not save to fallback customer_balances_data in app_settings:", err);
  }
}

// Helper to also sync invoice table if invoice_id is present
async function syncInvoiceRecord(invoiceId: string, balanceAmount: number, status: string, paidAmount: number) {
  try {
    const cleanDigits = String(invoiceId).replace(/\D/g, "") || String(invoiceId);
    const { data: row } = await supabase
      .from("invoices")
      .select("data")
      .or(`id.eq.${cleanDigits},id.eq.${invoiceId}`)
      .limit(1)
      .maybeSingle();

    if (row?.data) {
      const inv = typeof row.data === "object" ? row.data : JSON.parse(row.data || "{}");
      inv.paidAmount = paidAmount;
      inv.balanceAmount = balanceAmount;
      inv.balanceStatus = status;
      if (status === "settled" || status === "waived_final") {
        inv.paymentStatus = "PAID";
      } else if (status === "pending" && paidAmount > 0) {
        inv.paymentStatus = "PARTIALLY_PAID";
      }

      await supabase
        .from("invoices")
        .update({ data: inv })
        .or(`id.eq.${cleanDigits},id.eq.${invoiceId}`);
    }
  } catch (e) {
    console.warn("Could not sync invoice record with balance update:", e);
  }
}

/**
 * GET /api/customer-balance
 * Returns all balance records with KPI summaries (total pending amount, pending count, etc.)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status") || "all";
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    let records: CustomerBalanceRecord[] = [];
    let usedFallback = false;

    // Try primary database query
    const { data, error } = await supabase
      .from("customer_balances")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      records = data.map((d) => ({
        ...d,
        total_amount: Number(d.total_amount || 0),
        paid_amount: Number(d.paid_amount || 0),
        balance_amount: Number(d.balance_amount || 0),
      }));
    } else {
      // Fallback: check app_settings and invoices table
      usedFallback = true;
      const cached = await getFallbackBalances();
      records = cached;

      // Also harvest any balances from invoices table if missing from cache
      try {
        const { data: invRows } = await supabase
          .from("invoices")
          .select("id, data, created_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (Array.isArray(invRows)) {
          invRows.forEach((r) => {
            const d = typeof r.data === "object" ? r.data : JSON.parse(r.data || "{}");
            const bal = Number(d.balanceAmount || 0);
            const invNum = d.num || r.id;
            const existing = records.find((b) => b.invoice_id === invNum || b.id === r.id);

            if (bal > 0 && !existing) {
              records.push({
                id: r.id,
                invoice_id: invNum,
                customer_name: d.name || "Customer",
                customer_phone: d.phone || "N/A",
                total_amount: Number(d.tot || 0),
                paid_amount: Number(d.paidAmount || 0),
                balance_amount: bal,
                status: (d.balanceStatus as any) || "pending",
                payment_method: d.paymentMethod || "Cash",
                items_summary: Array.isArray(d.items) ? d.items.map((i: any) => i.n || i.name).join(", ") : undefined,
                created_at: r.created_at,
                updated_at: r.created_at,
              });
            }
          });
        }
      } catch (_) {}
    }

    // Apply status filter
    let filtered = records;
    if (filterStatus === "pending") {
      filtered = filtered.filter((r) => r.status === "pending" && r.balance_amount > 0);
    } else if (filterStatus === "settled") {
      filtered = filtered.filter((r) => r.status === "settled" || r.status === "waived_final" || r.balance_amount <= 0);
    }

    // Apply search filter
    if (search) {
      filtered = filtered.filter((r) => {
        const name = (r.customer_name || "").toLowerCase();
        const phone = (r.customer_phone || "").replace(/\D/g, "");
        const inv = (r.invoice_id || "").toLowerCase();
        return name.includes(search) || phone.includes(search) || inv.includes(search);
      });
    }

    // Calculate executive KPIs
    const pendingRecords = records.filter((r) => r.status === "pending" && r.balance_amount > 0);
    const totalPendingAmount = pendingRecords.reduce((sum, r) => sum + r.balance_amount, 0);
    const pendingCustomersCount = new Set(pendingRecords.map((r) => (r.customer_phone || "").replace(/\D/g, ""))).size;
    const settledCount = records.filter((r) => r.status === "settled" || r.status === "waived_final").length;

    return NextResponse.json({
      success: true,
      records: filtered,
      summary: {
        totalPendingAmount,
        pendingRecordsCount: pendingRecords.length,
        pendingCustomersCount,
        settledCount,
        totalRecordsCount: records.length,
      },
      fallbackMode: usedFallback,
    });
  } catch (err: any) {
    console.error("GET /api/customer-balance error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to fetch balances" }, { status: 500 });
  }
}

/**
 * POST /api/customer-balance
 * Creates or upserts a customer balance record (called from POS counter when billing).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      invoiceId,
      customerName,
      customerPhone,
      totalAmount,
      paidAmount,
      balanceAmount,
      status, // 'pending' | 'settled' | 'waived_final'
      paymentMethod,
      settlementNote,
      itemsSummary,
      razorpayPaymentLinkUrl,
      razorpayQrId,
    } = body;

    if (!customerPhone && !customerName) {
      return NextResponse.json({ success: false, error: "Missing customer details" }, { status: 400 });
    }

    const cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
    const total = Number(totalAmount || 0);
    const paid = Number(paidAmount || 0);
    const balance = Number(balanceAmount !== undefined ? balanceAmount : Math.max(0, total - paid));
    const recordStatus = status || (balance <= 0 ? "settled" : "pending");
    const invId = String(invoiceId || `UT-BAL-${Date.now().toString().slice(-6)}`);

    const newRecord: CustomerBalanceRecord = {
      id: invId,
      invoice_id: invId,
      customer_name: (customerName || "Customer").trim(),
      customer_phone: cleanPhone || "N/A",
      total_amount: total,
      paid_amount: paid,
      balance_amount: balance,
      status: recordStatus,
      payment_method: paymentMethod || "Cash",
      settlement_note: settlementNote || (recordStatus === "waived_final" ? "Agreed final payment waiver" : ""),
      items_summary: itemsSummary || "Fresh Rainbow Trout",
      razorpay_payment_link_url: razorpayPaymentLinkUrl || undefined,
      razorpay_qr_id: razorpayQrId || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Try to upsert in customer_balances table
    let savedInTable = false;
    try {
      const { error: dbError } = await supabase.from("customer_balances").upsert(
        {
          invoice_id: newRecord.invoice_id,
          customer_name: newRecord.customer_name,
          customer_phone: newRecord.customer_phone,
          total_amount: newRecord.total_amount,
          paid_amount: newRecord.paid_amount,
          balance_amount: newRecord.balance_amount,
          status: newRecord.status,
          payment_method: newRecord.payment_method,
          settlement_note: newRecord.settlement_note,
          items_summary: newRecord.items_summary,
          razorpay_payment_link_url: newRecord.razorpay_payment_link_url,
          razorpay_qr_id: newRecord.razorpay_qr_id,
          updated_at: newRecord.updated_at,
        },
        { onConflict: "invoice_id" }
      );
      if (!dbError) savedInTable = true;
    } catch (_) {}

    // 2. Also always sync fallback cache in app_settings
    const cached = await getFallbackBalances();
    const existingIdx = cached.findIndex((r) => r.invoice_id === newRecord.invoice_id || r.id === newRecord.id);
    if (existingIdx >= 0) {
      cached[existingIdx] = { ...cached[existingIdx], ...newRecord };
    } else {
      cached.unshift(newRecord);
    }
    await saveFallbackBalances(cached);

    // 3. Sync invoices table
    await syncInvoiceRecord(newRecord.invoice_id, newRecord.balance_amount, newRecord.status, newRecord.paid_amount);

    return NextResponse.json({ success: true, record: newRecord, savedInTable });
  } catch (err: any) {
    console.error("POST /api/customer-balance error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to save balance" }, { status: 500 });
  }
}

/**
 * PATCH /api/customer-balance
 * Handles repayments, marking settled as final waiver, or updating reminder timestamps.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, invoiceId, action, amountReceived, paymentMethod, settlementNote, razorpayPaymentLinkUrl, razorpayQrId } = body;

    const lookupId = id || invoiceId;
    if (!lookupId) {
      return NextResponse.json({ success: false, error: "Missing id or invoiceId" }, { status: 400 });
    }

    // Load existing record
    const cached = await getFallbackBalances();
    let recordIndex = cached.findIndex((r) => r.id === lookupId || r.invoice_id === lookupId);

    // Also check database
    let dbRecord: CustomerBalanceRecord | null = null;
    try {
      const { data } = await supabase
        .from("customer_balances")
        .select("*")
        .or(`id.eq.${lookupId},invoice_id.eq.${lookupId}`)
        .limit(1)
        .maybeSingle();
      if (data) dbRecord = data;
    } catch (_) {}

    const current: CustomerBalanceRecord = dbRecord || (recordIndex >= 0 ? cached[recordIndex] : null) || {
      id: lookupId,
      invoice_id: lookupId,
      customer_name: "Customer",
      customer_phone: "N/A",
      total_amount: 0,
      paid_amount: 0,
      balance_amount: 0,
      status: "pending",
    };

    const now = new Date().toISOString();

    if (action === "RECORD_PAYMENT") {
      const paying = Number(amountReceived || 0);
      if (paying <= 0) {
        return NextResponse.json({ success: false, error: "Amount must be greater than ₹0" }, { status: 400 });
      }

      const newPaid = current.paid_amount + paying;
      const newBalance = Math.max(0, current.balance_amount - paying);
      current.paid_amount = newPaid;
      current.balance_amount = newBalance;
      current.payment_method = paymentMethod || current.payment_method || "Cash";
      current.status = newBalance <= 0 ? "settled" : "pending";
      current.settlement_note = settlementNote || `Received payment of ₹${paying} via ${paymentMethod || "Cash"}`;
      current.updated_at = now;
    } else if (action === "SETTLE_FINAL_WAIVER") {
      // Customer paid some amount in cash and both agreed that this is the final payment (no balance kept)
      const waivedAmount = current.balance_amount;
      current.balance_amount = 0;
      current.status = "waived_final";
      current.settlement_note = settlementNote || `Waived remaining ₹${waivedAmount} as agreed final settlement/discount`;
      current.updated_at = now;
    } else if (action === "REMINDER_SENT") {
      current.last_reminder_sent_at = now;
      current.updated_at = now;
    } else if (action === "UPDATE_LINKS") {
      if (razorpayPaymentLinkUrl) current.razorpay_payment_link_url = razorpayPaymentLinkUrl;
      if (razorpayQrId) current.razorpay_qr_id = razorpayQrId;
      current.updated_at = now;
    }

    // 1. Update in DB if table exists
    try {
      await supabase
        .from("customer_balances")
        .update({
          paid_amount: current.paid_amount,
          balance_amount: current.balance_amount,
          status: current.status,
          payment_method: current.payment_method,
          settlement_note: current.settlement_note,
          razorpay_payment_link_url: current.razorpay_payment_link_url,
          razorpay_qr_id: current.razorpay_qr_id,
          last_reminder_sent_at: current.last_reminder_sent_at,
          updated_at: current.updated_at,
        })
        .or(`id.eq.${lookupId},invoice_id.eq.${lookupId}`);
    } catch (_) {}

    // 2. Update in fallback cache
    if (recordIndex >= 0) {
      cached[recordIndex] = current;
    } else {
      cached.unshift(current);
    }
    await saveFallbackBalances(cached);

    // 3. Sync invoices table
    await syncInvoiceRecord(current.invoice_id, current.balance_amount, current.status, current.paid_amount);

    return NextResponse.json({ success: true, record: current });
  } catch (err: any) {
    console.error("PATCH /api/customer-balance error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to update balance" }, { status: 500 });
  }
}

/**
 * DELETE /api/customer-balance
 * Removes a balance record
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    try {
      await supabase
        .from("customer_balances")
        .delete()
        .or(`id.eq.${id},invoice_id.eq.${id}`);
    } catch (_) {}

    const cached = await getFallbackBalances();
    const filtered = cached.filter((r) => r.id !== id && r.invoice_id !== id);
    await saveFallbackBalances(filtered);

    return NextResponse.json({ success: true, message: "Record deleted" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to delete" }, { status: 500 });
  }
}
