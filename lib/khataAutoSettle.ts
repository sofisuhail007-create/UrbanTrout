import { createClient } from "@supabase/supabase-js";
import { enqueueWhatsAppDispatch } from "@/lib/whatsappDispatch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface AutoSettleParams {
  paymentId: string;
  paymentLinkId?: string | null;
  orderRef?: string | null;
  amount: number; // in Rupees
  customerPhone?: string | null;
  customerName?: string | null;
  notes?: Record<string, any> | null;
  method?: string | null;
}

export async function autoSettleKhataPayment({
  paymentId,
  paymentLinkId,
  orderRef,
  amount,
  customerPhone,
  customerName,
  notes,
  method = "Razorpay Link (Verified)"
}: AutoSettleParams): Promise<{ settled: boolean; invoiceId?: string; customerName?: string; newBalance?: number }> {
  try {
    const cleanPhone = customerPhone ? String(customerPhone).replace(/\D/g, "").slice(-10) : "";
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return { settled: false };

    console.log(`[khataAutoSettle] Checking for pending khata balance for phone: "${cleanPhone}", name: "${customerName}", amount: ₹${numAmount}, ref: "${orderRef}"`);

    let targetInvoiceId: string | null = null;
    let targetVslId: string | null = null;
    let matchedCustomerName = customerName || "Customer";

    // ── Strategy 1: Explicit Balance Reference (e.g. BAL-VL-20261005-2729 or BAL-...) ──
    if (orderRef && (orderRef.startsWith("BAL-") || orderRef.startsWith("Bal-") || orderRef.startsWith("bal-"))) {
      targetInvoiceId = orderRef.replace(/^(BAL-|Bal-|bal-)/i, "").trim();
      console.log(`[khataAutoSettle] Matched by explicit orderRef BAL prefix: "${targetInvoiceId}"`);
    }

    // ── Strategy 2: Direct match by Razorpay Payment Link ID ──
    if (!targetInvoiceId && paymentLinkId) {
      // Check customer_balances table
      try {
        const { data: cbByLink } = await supabase
          .from("customer_balances")
          .select("id, invoice_id, customer_name, customer_phone, balance_amount, status")
          .eq("razorpay_payment_link_id", paymentLinkId)
          .maybeSingle();

        if (cbByLink) {
          targetInvoiceId = cbByLink.invoice_id || cbByLink.id;
          matchedCustomerName = cbByLink.customer_name || matchedCustomerName;
          console.log(`[khataAutoSettle] Matched in customer_balances by link ID ${paymentLinkId}: "${targetInvoiceId}"`);
        }
      } catch (_) {}

      // Check vending_sales_log table
      if (!targetInvoiceId) {
        try {
          const { data: vslByLink } = await supabase
            .from("vending_sales_log")
            .select("id, custom_fields")
            .eq("custom_fields->>razorpay_payment_link_id", paymentLinkId)
            .maybeSingle();

          if (vslByLink) {
            targetVslId = vslByLink.id;
            targetInvoiceId = vslByLink.custom_fields?.balance_ref_id || vslByLink.id;
            matchedCustomerName = vslByLink.custom_fields?.customer_name || matchedCustomerName;
            console.log(`[khataAutoSettle] Matched in vending_sales_log by link ID ${paymentLinkId}: "${targetVslId}"`);
          }
        } catch (_) {}
      }
    }

    // ── Strategy 3: Smart Match by Customer Phone & Open Balance ──
    // If not matched by ID (e.g. link was generated via WhatsApp order, Remote Order, or Counter QR):
    if (!targetInvoiceId && !targetVslId && cleanPhone && cleanPhone.length === 10) {
      try {
        // Find most recent pending khata in vending_sales_log for this phone
        const { data: vslList } = await supabase
          .from("vending_sales_log")
          .select("id, custom_fields, amount_paid, expected_amount, weight_kg, rate_per_kg, payment_mode, created_at")
          .or(`custom_fields->>customer_phone.eq.${cleanPhone},notes.ilike.%${cleanPhone}%`)
          .order("created_at", { ascending: false })
          .limit(10);

        if (vslList && vslList.length > 0) {
          for (const item of vslList) {
            const cf = item.custom_fields || {};
            const bal = Number(cf.balance_amount || 0);
            const paid = Number(item.amount_paid || 0);
            const exp = Number(cf.expected_amount || item.expected_amount || (Number(item.weight_kg) * Number(item.rate_per_kg)));
            const isKhataMode = (item.payment_mode || "").toLowerCase().includes("credit") || (item.payment_mode || "").toLowerCase().includes("khata");
            const isUnsettled = (bal > 0 || (isKhataMode && paid < exp) || cf.balance_status === "pending") && cf.balance_status !== "settled";

            if (isUnsettled) {
              targetVslId = item.id;
              targetInvoiceId = cf.balance_ref_id || item.id;
              matchedCustomerName = cf.customer_name || matchedCustomerName;
              console.log(`[khataAutoSettle] Smart phone match in vending_sales_log: ID=${targetVslId}, Invoice=${targetInvoiceId}, Expected=₹${exp}, Paid=₹${paid}`);
              break;
            }
          }
        }
      } catch (err) {
        console.warn("[khataAutoSettle] Phone search error in vending_sales_log:", err);
      }
    }

    // ── Strategy 4: Fallback App Settings Khata Cache Search ──
    if (!targetInvoiceId && !targetVslId) {
      try {
        const { data: appSettings } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "customer_balances_data")
          .single();

        if (appSettings?.value) {
          const cachedList = JSON.parse(appSettings.value);
          if (Array.isArray(cachedList)) {
            const candidate = cachedList.find((item: any) => {
              if (item.status === "settled") return false;
              const phoneMatch = cleanPhone && item.customer_phone && String(item.customer_phone).includes(cleanPhone);
              const linkMatch = paymentLinkId && item.razorpay_payment_link_id === paymentLinkId;
              const nameMatch = customerName && item.customer_name && item.customer_name.toLowerCase().includes(customerName.toLowerCase().trim());
              const amountMatch = Math.abs(Number(item.balance_amount) - numAmount) <= 10;
              return linkMatch || (phoneMatch && (amountMatch || item.balance_amount > 0)) || (nameMatch && amountMatch);
            });

            if (candidate) {
              targetInvoiceId = candidate.invoice_id || candidate.id;
              matchedCustomerName = candidate.customer_name || matchedCustomerName;
              console.log(`[khataAutoSettle] Matched in app_settings customer_balances_data: "${targetInvoiceId}"`);
            }
          }
        }
      } catch (_) {}
    }

    // If no open khata was matched, this was a normal online retail sale
    if (!targetInvoiceId && !targetVslId) {
      console.log(`[khataAutoSettle] No pending khata found for this payment (normal online sale).`);
      return { settled: false };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // EXECUTE AUTO-SETTLEMENT ON ALL RELEVANT STORES
    // ══════════════════════════════════════════════════════════════════════════
    const nowIso = new Date().toISOString();
    let newCalculatedBalance = 0;

    // 1. Update vending_sales_log
    try {
      let vslQuery = supabase
        .from("vending_sales_log")
        .select("id, custom_fields, notes, payment_mode, amount_paid, expected_amount, weight_kg, rate_per_kg");

      if (targetVslId) {
        vslQuery = vslQuery.eq("id", targetVslId);
      } else if (targetInvoiceId) {
        vslQuery = vslQuery.or(`id.eq.${targetInvoiceId},custom_fields->>balance_ref_id.eq.${targetInvoiceId}`);
      }

      const { data: vslMatch } = await vslQuery.maybeSingle();

      if (vslMatch) {
        const cf = vslMatch.custom_fields || {};
        const prevPaid = Number(vslMatch.amount_paid) || 0;
        const expAmt = Number(cf.expected_amount) || Number(vslMatch.expected_amount) || (Number(vslMatch.weight_kg) * Number(vslMatch.rate_per_kg));
        const updatedPaid = prevPaid + numAmount;
        newCalculatedBalance = Math.max(0, expAmt - updatedPaid);
        const isSettled = newCalculatedBalance <= 0;

        cf.balance_amount = newCalculatedBalance;
        cf.balance_status = isSettled ? "settled" : "pending";
        cf.is_full_payment = isSettled;
        cf.settled_at = nowIso;
        cf.settled_payment_method = `Razorpay (Verified ${paymentId})`;

        if (!Array.isArray(cf.payment_history)) cf.payment_history = [];
        cf.payment_history.push({
          amount: numAmount,
          method: method || "Razorpay Link (Verified)",
          payment_id: paymentId,
          timestamp: nowIso,
          note: `Khata payment auto-settled via Razorpay (Payment ID: ${paymentId})`,
        });

        if (!Array.isArray(cf.edit_history)) cf.edit_history = [];
        cf.edit_history.push({
          summary: `Khata cleared automatically via Razorpay payment ${paymentId} (₹${numAmount})`,
          timestamp: nowIso,
          actor_name: "Razorpay (Auto-Settle)",
          actor_role: "System",
        });

        const updatedMode = isSettled
          ? ((vslMatch.payment_mode || "").toLowerCase().includes("cash") ? "Cash + Online (Razorpay)" : "Online Payment (Khata Cleared via Razorpay)")
          : vslMatch.payment_mode;

        const updatedNotes = (vslMatch.notes || "").trim()
          ? `${vslMatch.notes} [KHATA PAID ✓ ₹${numAmount} via Razorpay ${paymentId}]`
          : `[KHATA PAID ✓ ₹${numAmount} via Razorpay ${paymentId}]`;

        await supabase
          .from("vending_sales_log")
          .update({
            amount_paid: updatedPaid,
            payment_mode: updatedMode,
            custom_fields: cf,
            notes: updatedNotes,
            updated_at: nowIso,
          })
          .eq("id", vslMatch.id);

        console.log(`✅ [khataAutoSettle] Vending sales log ${vslMatch.id} updated! Paid: ₹${prevPaid} → ₹${updatedPaid}, Remaining: ₹${newCalculatedBalance}`);
      }
    } catch (vslErr) {
      console.warn("[khataAutoSettle] Error updating vending_sales_log:", vslErr);
    }

    // 2. Update customer_balances table
    try {
      let cbQuery = supabase.from("customer_balances").select("*");
      if (targetInvoiceId) {
        cbQuery = cbQuery.or(`id.eq.${targetInvoiceId},invoice_id.eq.${targetInvoiceId}`);
      } else if (cleanPhone) {
        cbQuery = cbQuery.eq("customer_phone", cleanPhone).eq("status", "pending");
      }
      const { data: cbRecord } = await cbQuery.maybeSingle();

      if (cbRecord) {
        const prevPaid = Number(cbRecord.paid_amount || 0);
        const prevBal = Number(cbRecord.balance_amount || 0);
        const updatedPaid = prevPaid + numAmount;
        const updatedBal = Math.max(0, prevBal - numAmount);
        const isSettled = updatedBal <= 0;

        await supabase
          .from("customer_balances")
          .update({
            paid_amount: updatedPaid,
            balance_amount: updatedBal,
            status: isSettled ? "settled" : "pending",
            settlement_note: `Paid in full via Razorpay Online Link (Payment ID: ${paymentId})`,
            payment_method: "Razorpay Link (Verified)",
            updated_at: nowIso,
          })
          .eq("id", cbRecord.id);

        console.log(`✅ [khataAutoSettle] customer_balances row ${cbRecord.id} settled! Balance: ₹${prevBal} → ₹${updatedBal}`);
      }
    } catch (cbErr) {
      console.warn("[khataAutoSettle] Error updating customer_balances table:", cbErr);
    }

    // 3. Update app_settings fallback cache (customer_balances_data)
    try {
      const { data: appSettings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "customer_balances_data")
        .single();

      if (appSettings?.value) {
        const cachedList = JSON.parse(appSettings.value);
        if (Array.isArray(cachedList)) {
          let updatedCache = false;
          for (let i = 0; i < cachedList.length; i++) {
            const item = cachedList[i];
            const matchById = targetInvoiceId && (item.invoice_id === targetInvoiceId || item.id === targetInvoiceId);
            const matchByPhone = cleanPhone && item.customer_phone && String(item.customer_phone).includes(cleanPhone) && item.status !== "settled";

            if (matchById || matchByPhone) {
              const prevBal = Number(item.balance_amount || 0);
              const updatedBal = Math.max(0, prevBal - numAmount);
              item.paid_amount = (Number(item.paid_amount) || 0) + numAmount;
              item.balance_amount = updatedBal;
              item.status = updatedBal <= 0 ? "settled" : "pending";
              item.settlement_note = `Paid in full via Razorpay Online Link (Payment ID: ${paymentId})`;
              item.updated_at = nowIso;
              updatedCache = true;
              console.log(`✅ [khataAutoSettle] app_settings customer_balances_data entry ${item.id} updated!`);
              break;
            }
          }

          if (updatedCache) {
            await supabase.from("app_settings").upsert({
              key: "customer_balances_data",
              value: JSON.stringify(cachedList),
              description: "Fallback JSON storage for customer balances and khata ledger",
              updated_at: nowIso,
            }, { onConflict: "key" });
          }
        }
      }
    } catch (cacheErr) {
      console.warn("[khataAutoSettle] Error updating app_settings cache:", cacheErr);
    }

    // 4. Send Instant WhatsApp Confirmation to Customer that Khata is Cleared!
    if (cleanPhone && cleanPhone.length === 10) {
      try {
        const isFullyCleared = newCalculatedBalance <= 0;
        const confirmationMsg = isFullyCleared
          ? `✅ *Khata Payment Received & Balance Cleared!* 🐟\n\nDear *${matchedCustomerName}*,\nThank you! Your payment of *₹${numAmount}* has been verified via Razorpay.\n\n📋 *Account Statement:*\n• *Status:* Outstanding Balance Fully Cleared (₹0)\n• *Payment ID:* ${paymentId}\n\nYour khata account with Urban Trout is completely settled. Thank you for your valued patronage!`
          : `✅ *Partial Payment Received!* 🐟\n\nDear *${matchedCustomerName}*,\nThank you! Your partial repayment of *₹${numAmount}* has been verified via Razorpay.\n\n📋 *Account Statement:*\n• *Remaining Balance Due:* *₹${newCalculatedBalance}*\n• *Payment ID:* ${paymentId}\n\nYour khata record has been updated. Thank you!`;

        await enqueueWhatsAppDispatch({
          orderRef: targetInvoiceId || `BAL-${paymentId.slice(-6)}`,
          phone: cleanPhone,
          customerName: matchedCustomerName,
          status: "payment_confirmed",
          messageText: confirmationMsg,
        });
        console.log(`✅ [khataAutoSettle] Customer WhatsApp balance clearance receipt enqueued for +91 ${cleanPhone}`);
      } catch (waErr) {
        console.warn("[khataAutoSettle] WhatsApp dispatch notice:", waErr);
      }
    }

    return {
      settled: true,
      invoiceId: targetInvoiceId || undefined,
      customerName: matchedCustomerName,
      newBalance: newCalculatedBalance,
    };
  } catch (globalErr: any) {
    console.error("[khataAutoSettle] Global error auto-settling khata:", globalErr?.message);
    return { settled: false };
  }
}
