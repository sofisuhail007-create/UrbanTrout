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

    // 1. Try primary database query on customer_balances
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
      usedFallback = true;
      const cached = await getFallbackBalances();
      records = cached;
    }

    // 2. Always harvest live balances from vending_sales_log (Vending Center dispatches)
    try {
      const { data: vslRows } = await supabase
        .from("vending_sales_log")
        .select("*")
        .not("custom_fields->balance_amount", "is", null)
        .order("entry_date", { ascending: false });

      if (Array.isArray(vslRows)) {
        vslRows.forEach((r) => {
          const cf = r.custom_fields || {};
          const bal = Number(cf.balance_amount || 0);
          const status = (cf.balance_status as any) || (bal > 0 ? "pending" : "settled");
          const refId = cf.balance_ref_id || `VL-${(r.entry_date || "").replace(/\D/g, "")}-${r.id.slice(-4)}`;

          const existing = records.find((b) => b.invoice_id === refId || b.id === r.id);
          if (!existing && (bal > 0 || status === "waived_final" || status === "settled")) {
            const w = Number(r.weight_kg) || 0;
            const rate = Number(r.rate_per_kg) || 0;
            const exp = Number(cf.expected_amount) || Math.round(w * rate);
            const paid = Number(r.amount_paid) || 0;

            records.push({
              id: r.id,
              invoice_id: refId,
              customer_name: cf.customer_name || "Counter Customer",
              customer_phone: cf.customer_phone || "N/A",
              total_amount: exp,
              paid_amount: paid,
              balance_amount: bal,
              status: status,
              payment_method: r.payment_mode || "Cash",
              settlement_note: r.notes ? `Vending: ${r.notes}` : `Vending Center Sale: ${w} Kg ${r.product_type}`,
              items_summary: `${w} Kg ${r.product_type} Trout (Vending Center)`,
              created_at: `${r.entry_date}T${r.entry_time || "12:00:00"}`,
              updated_at: r.updated_at || r.created_at || new Date().toISOString(),
            });
          }
        });
      }
    } catch (e) {
      console.warn("Could not harvest balances from vending_sales_log:", e);
    }

    // 3. Also harvest any balances from invoices table
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

    // 1. Try to save or update in customer_balances table
    let savedInTable = false;
    try {
      const { data: existingRow } = await supabase
        .from("customer_balances")
        .select("id")
        .eq("invoice_id", newRecord.invoice_id)
        .maybeSingle();

      if (existingRow?.id) {
        const { error: updateErr } = await supabase
          .from("customer_balances")
          .update({
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
          })
          .eq("id", existingRow.id);
        if (!updateErr) savedInTable = true;
      } else {
        const { error: insertErr } = await supabase.from("customer_balances").insert({
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
        });
        if (!insertErr) savedInTable = true;
      }
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

    // 4. Also sync vending_sales_log table if this is a vending log balance
    try {
      const { data: vslMatch } = await supabase
        .from("vending_sales_log")
        .select("id, custom_fields")
        .or(`id.eq.${newRecord.invoice_id},custom_fields->>balance_ref_id.eq.${newRecord.invoice_id}`)
        .maybeSingle();

      if (vslMatch) {
        const cf = vslMatch.custom_fields || {};
        cf.balance_amount = newRecord.balance_amount;
        cf.balance_status = newRecord.status;
        cf.customer_name = newRecord.customer_name;
        cf.customer_phone = newRecord.customer_phone;
        await supabase
          .from("vending_sales_log")
          .update({ custom_fields: cf })
          .eq("id", vslMatch.id);
      }
    } catch (_) {}

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
    if (!lookupId) return NextResponse.json({ success: false, error: "Missing record id" }, { status: 400 });

    const cached = await getFallbackBalances();
    const recordIndex = cached.findIndex((r) => r.id === lookupId || r.invoice_id === lookupId);
    let current: CustomerBalanceRecord | null = recordIndex >= 0 ? cached[recordIndex] : null;

    if (!current) {
      try {
        const { data: dbRecord } = await supabase
          .from("customer_balances")
          .select("*")
          .or(`id.eq.${lookupId},invoice_id.eq.${lookupId}`)
          .maybeSingle();

        if (dbRecord) {
          current = {
            ...dbRecord,
            total_amount: Number(dbRecord.total_amount || 0),
            paid_amount: Number(dbRecord.paid_amount || 0),
            balance_amount: Number(dbRecord.balance_amount || 0),
          };
        }
      } catch (_) {}
    }

    // Check vending_sales_log if not found yet
    if (!current) {
      try {
        const { data: vslMatch } = await supabase
          .from("vending_sales_log")
          .select("*")
          .or(`id.eq.${lookupId},custom_fields->>balance_ref_id.eq.${lookupId}`)
          .maybeSingle();

        if (vslMatch) {
          const cf = vslMatch.custom_fields || {};
          const w = Number(vslMatch.weight_kg) || 0;
          const rate = Number(vslMatch.rate_per_kg) || 0;
          const exp = Number(cf.expected_amount) || Math.round(w * rate);
          const paid = Number(vslMatch.amount_paid) || 0;
          const bal = Number(cf.balance_amount || 0);

          current = {
            id: vslMatch.id,
            invoice_id: cf.balance_ref_id || lookupId,
            customer_name: cf.customer_name || "Counter Customer",
            customer_phone: cf.customer_phone || "N/A",
            total_amount: exp,
            paid_amount: paid,
            balance_amount: bal,
            status: cf.balance_status || "pending",
            payment_method: vslMatch.payment_mode || "Cash",
            created_at: vslMatch.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      } catch (_) {}
    }

    if (!current) {
      return NextResponse.json({ success: false, error: "Balance record not found" }, { status: 404 });
    }

    // Handle different actions
    if (action === "RECORD_PAYMENT") {
      const payment = Number(amountReceived || 0);
      if (payment > 0) {
        current.paid_amount = Number((current.paid_amount + payment).toFixed(2));
        current.balance_amount = Number(Math.max(0, current.balance_amount - payment).toFixed(2));
        current.status = current.balance_amount <= 0 ? "settled" : "pending";
        current.payment_method = paymentMethod || current.payment_method || "Cash";
        if (settlementNote) {
          current.settlement_note = current.settlement_note
            ? `${current.settlement_note} | Repayment ₹${payment}: ${settlementNote}`
            : `Repayment ₹${payment}: ${settlementNote}`;
        }
      }
    } else if (action === "SETTLE_FINAL_WAIVER") {
      current.status = "waived_final";
      current.balance_amount = 0;
      current.settlement_note = settlementNote || "Agreed final payment discount waiver";
    } else if (action === "UPDATE_REMINDER") {
      current.last_reminder_sent_at = new Date().toISOString();
      if (razorpayPaymentLinkUrl) current.razorpay_payment_link_url = razorpayPaymentLinkUrl;
      if (razorpayQrId) current.razorpay_qr_id = razorpayQrId;
    }

    current.updated_at = new Date().toISOString();

    // 1. Update in customer_balances table
    try {
      const { data: existingRow } = await supabase
        .from("customer_balances")
        .select("id")
        .or(`id.eq.${lookupId},invoice_id.eq.${lookupId}`)
        .maybeSingle();

      if (existingRow?.id) {
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
          .eq("id", existingRow.id);
      } else {
        await supabase.from("customer_balances").insert({
          invoice_id: current.invoice_id,
          customer_name: current.customer_name,
          customer_phone: current.customer_phone,
          total_amount: current.total_amount,
          paid_amount: current.paid_amount,
          balance_amount: current.balance_amount,
          status: current.status,
          payment_method: current.payment_method,
          settlement_note: current.settlement_note,
          razorpay_payment_link_url: current.razorpay_payment_link_url,
          razorpay_qr_id: current.razorpay_qr_id,
          last_reminder_sent_at: current.last_reminder_sent_at,
          updated_at: current.updated_at,
        });
      }
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

    // 4. Also sync vending_sales_log table if this is a vending log balance
    try {
      const { data: vslMatch } = await supabase
        .from("vending_sales_log")
        .select("id, custom_fields, notes, payment_mode, amount_paid, expected_amount, weight_kg, rate_per_kg")
        .or(`id.eq.${lookupId},custom_fields->>balance_ref_id.eq.${lookupId},custom_fields->>balance_ref_id.eq.${current.invoice_id}`)
        .maybeSingle();

      if (vslMatch) {
        const cf = vslMatch.custom_fields || {};
        const nowIso = new Date().toISOString();
        const nowFormatted = new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        });

        cf.balance_amount = current.balance_amount;
        cf.balance_status = current.status;

        // Structured payment history array in custom_fields
        if (!Array.isArray(cf.payment_history)) {
          cf.payment_history = [];
        }
        if (action === "RECORD_PAYMENT") {
          cf.payment_history.push({
            amount: Number(amountReceived || current.paid_amount),
            method: current.payment_method || "Razorpay QR (Verified)",
            timestamp: nowIso,
            note: settlementNote || "Balance payment cleared",
          });
        }

        // Check if fully settled
        const isSettled = current.status === "settled" || current.balance_amount <= 0;
        if (isSettled) {
          cf.settled_at = nowIso;
          cf.is_full_payment = true;
          cf.settled_payment_method = current.payment_method || "Razorpay QR (Verified)";
        } else if (current.status === "waived_final") {
          cf.settled_at = nowIso;
          cf.is_waived = true;
        }

        // Amount paid should be the full updated paid_amount (e.g. 500 + 179 = 679)
        const updatedAmountPaid = Number(current.paid_amount || vslMatch.amount_paid);
        const expAmt = Number(cf.expected_amount) || Number(vslMatch.expected_amount) || (Number(vslMatch.weight_kg) * Number(vslMatch.rate_per_kg));
        const updatedDiscount = Math.max(0, expAmt - updatedAmountPaid);

        // Payment mode update (e.g. Cash + Online QR)
        let updatedMode = vslMatch.payment_mode || "Cash";
        if (current.payment_method?.includes("QR") || current.payment_method?.includes("Online") || current.payment_method?.includes("Razorpay")) {
          if (updatedMode.toLowerCase().includes("cash") && isSettled) {
            updatedMode = "Cash + Online QR";
          } else {
            updatedMode = current.payment_method;
          }
        }

        // Timestamped audit note
        let updatedNotes = vslMatch.notes || "";
        if (action === "RECORD_PAYMENT" && Number(amountReceived || 0) > 0) {
          const noteText = isSettled
            ? `[FULL PAYMENT ✓: ₹${amountReceived} paid via ${current.payment_method || "QR"} on ${nowFormatted}]`
            : `[PARTIAL PAYMENT: ₹${amountReceived} paid via ${current.payment_method || "QR"} on ${nowFormatted} - Remaining: ₹${current.balance_amount}]`;
          updatedNotes = updatedNotes ? `${updatedNotes} | ${noteText}` : noteText;
        } else if (action === "SETTLE_FINAL_WAIVER") {
          const noteText = `[WAIVED AS FINAL SETTLEMENT on ${nowFormatted}: ${settlementNote || "Concession agreed"}]`;
          updatedNotes = updatedNotes ? `${updatedNotes} | ${noteText}` : noteText;
        }

        await supabase
          .from("vending_sales_log")
          .update({
            amount_paid: updatedAmountPaid,
            discount_amount: updatedDiscount,
            payment_mode: updatedMode,
            notes: updatedNotes,
            custom_fields: cf,
            updated_at: nowIso,
          })
          .eq("id", vslMatch.id);

        // Also update fallback cache vending_log_data in app_settings
        try {
          const { data: setRow } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "vending_log_data")
            .single();

          if (setRow?.value) {
            const list = JSON.parse(setRow.value);
            const idx = list.findIndex(
              (x: any) =>
                x.id === vslMatch.id ||
                x.custom_fields?.balance_ref_id === lookupId ||
                x.custom_fields?.balance_ref_id === current.invoice_id
            );
            if (idx >= 0) {
              list[idx].amount_paid = updatedAmountPaid;
              list[idx].discount_amount = updatedDiscount;
              list[idx].payment_mode = updatedMode;
              list[idx].notes = updatedNotes;
              list[idx].custom_fields = cf;
              list[idx].updated_at = nowIso;
              await supabase.from("app_settings").upsert(
                {
                  key: "vending_log_data",
                  value: JSON.stringify(list.slice(0, 1000)),
                  updated_at: nowIso,
                },
                { onConflict: "key" }
              );
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn("Could not sync vending_sales_log balance update:", e);
    }

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

    // Also sync delete/clear in vending_sales_log
    try {
      const { data: vslMatch } = await supabase
        .from("vending_sales_log")
        .select("id, custom_fields")
        .or(`id.eq.${id},custom_fields->>balance_ref_id.eq.${id}`)
        .maybeSingle();

      if (vslMatch) {
        const cf = vslMatch.custom_fields || {};
        cf.balance_amount = 0;
        cf.balance_status = "none";
        await supabase
          .from("vending_sales_log")
          .update({ custom_fields: cf })
          .eq("id", vslMatch.id);
      }
    } catch (_) {}

    return NextResponse.json({ success: true, message: "Record deleted" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Failed to delete" }, { status: 500 });
  }
}
