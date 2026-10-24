import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";
import { findKhataInvoice, isUUID } from "@/lib/khataInvoice";
import Razorpay from "razorpay";

// Use service role key to ensure admin operations (update/delete) succeed with RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function getRazorpayClient() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { invoiceId, data } = body;

    if (!invoiceId || !data) {
      return NextResponse.json({ success: false, error: "Missing invoiceId or data" }, { status: 400 });
    }

    const cleanDigits = String(invoiceId).replace(/\D/g, "");
    const id = cleanDigits || String(invoiceId);

    const { error } = await supabase.from("invoices").upsert(
      {
        id,
        data: typeof data === "object" ? data : JSON.parse(data),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Error saving invoice:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("API Invoice POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";

    // If no ID is passed, return list of all recent invoices/remote orders
    if (!id) {
      const limit = parseInt(searchParams.get("limit") || "100", 10);
      const { data: rows, error } = await supabase
        .from("invoices")
        .select("id, data, created_at, expires_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Supabase list invoices error:", error.message);
        // Fallback check in app_settings
        try {
          const { data: fb } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "remote_invoices_cache")
            .single();
          if (fb?.value) {
            return NextResponse.json({ success: true, invoices: JSON.parse(fb.value) });
          }
        } catch (_) {}
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const list = (rows || []).map((r) => {
        const d = typeof r.data === "object" && r.data ? r.data : JSON.parse(r.data || "{}");
        return {
          id: r.id,
          created_at: r.created_at,
          expires_at: r.expires_at,
          data: d,
          ...d,
        };
      });

      // Cache recent list in app_settings for safety
      try {
        supabase.from("app_settings").upsert({
          key: "remote_invoices_cache",
          value: JSON.stringify(list.slice(0, 100)),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" }).then(() => {});
      } catch (_) {}

      return NextResponse.json({ success: true, invoices: list });
    }

    const cleanDigits = id.replace(/\D/g, "");
    const lookupId = cleanDigits || id;

    // Fetch single invoice: matches either raw string or clean digits
    const { data: row, error } = await supabase
      .from("invoices")
      .select("data, expires_at")
      .or(`id.eq.${lookupId},id.eq.${id}`)
      .limit(1)
      .maybeSingle();

    if (row?.data) {
      return NextResponse.json({ success: true, invoice: row.data, expiresAt: row.expires_at });
    }

    if (error && error.code !== "PGRST116") {
      console.error("Supabase invoice fetch error:", error.message);
    }

    // 2. Fallback: Search in Customer Balances & Vending Sales Log (Khata Invoices)
    const khataInv = await findKhataInvoice(id, supabase);
    if (khataInv) {
      return NextResponse.json({
        success: true,
        invoice: khataInv,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // If ID was stripped to cleanDigits (e.g. 202610249236), try reconstructing VL-YYYYMMDD-XXXX
    if (cleanDigits.length === 12 && cleanDigits.startsWith("202")) {
      const reconstructed = `VL-${cleanDigits.slice(0, 8)}-${cleanDigits.slice(8)}`;
      const khataRecon = await findKhataInvoice(reconstructed, supabase);
      if (khataRecon) {
        return NextResponse.json({
          success: true,
          invoice: khataRecon,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    // 3. Fallback: Search in Online Store Orders table
    const numId = parseInt(cleanDigits, 10);
    if (!isNaN(numId) && numId > 0) {
      const { data: dbOrder } = await supabase
        .from("orders")
        .select("*")
        .or(`order_number.eq.${numId},id.eq.${id}`)
        .limit(1)
        .maybeSingle();

      if (dbOrder) {
        const orderItems = Array.isArray(dbOrder.items) ? dbOrder.items : [];
        let totalOrdWeight = 0;
        let totalActWeight = 0;
        const mappedItems = orderItems.map((i: any) => {
          const ordQty = typeof i.orderedWeight === "number" ? i.orderedWeight : (typeof i.orderedWeightKg === "number" ? i.orderedWeightKg : parseFloat(i.quantity) || 1);
          const actQty = typeof i.actualWeight === "number" ? i.actualWeight : (typeof i.weightKg === "number" ? i.weightKg : parseFloat(i.quantity) || 1);
          const rate = typeof i.price === "number" ? i.price : parseFloat(i.price) || 580;
          totalOrdWeight += ordQty;
          totalActWeight += actQty;
          return {
            name: i.name || "Fresh Rainbow Trout",
            weightKg: actQty,
            orderedWeightKg: ordQty,
            pricePerKg: rate,
            total: actQty * rate,
          };
        });

        const isPaid = dbOrder.status === "processing" || dbOrder.status === "out_for_delivery" || dbOrder.status === "delivered";
        const grandTotal = Number(dbOrder.total) || 0;
        const paidAmount = dbOrder.paid_amount !== undefined
          ? Number(dbOrder.paid_amount)
          : (isPaid ? grandTotal : 0);
        const balanceAmount = grandTotal > paidAmount ? grandTotal - paidAmount : (isPaid ? 0 : grandTotal);

        return NextResponse.json({
          success: true,
          invoice: {
            invoiceNumber: `UT-INV-${dbOrder.order_number || dbOrder.id.slice(0, 6)}`,
            customerName: dbOrder.customer_name || "Valued Customer",
            customerPhone: dbOrder.customer_phone || "N/A",
            customerAddress: dbOrder.shipping_address || dbOrder.address || "",
            items: mappedItems,
            orderedWeight: totalOrdWeight > 0 ? totalOrdWeight : totalActWeight,
            totalWeight: totalActWeight,
            subtotal: grandTotal,
            deliveryFee: 0,
            grandTotal,
            paidAmount,
            balanceAmount,
            refundAmount: 0,
            createdAt: new Date(dbOrder.created_at).getTime(),
            isExpired: false,
            paymentStatus: isPaid ? "PAID" : "PAYMENT DUE",
            paymentMethod: isPaid ? "Online / Advance" : "Cash on Delivery",
          },
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
  } catch (err: any) {
    console.error("API Invoice GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      invoiceId,
      paymentStatus,
      paymentId,
      paymentMethod,
      notes,
      name,
      customerName,
      phone,
      customerPhone,
      address,
      isExpired,
      paidAmount,
      balanceAmount,
      refundAmount,
      reactivate,
    } = body;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: "Missing invoiceId" }, { status: 400 });
    }

    const cleanDigits = String(invoiceId).replace(/\D/g, "") || String(invoiceId);

    // Look up by cleanDigits or exact invoiceId
    const { data: matchedRows } = await supabase
      .from("invoices")
      .select("id, data")
      .or(`id.eq.${cleanDigits},id.eq.${invoiceId}`)
      .limit(1);

    const row = matchedRows?.[0];

    if (!row) {
      // Check if this is a Customer Balance / Khata invoice
      const khataInv = await findKhataInvoice(invoiceId, supabase);
      if (khataInv) {
        const isSettled = paymentStatus === "PAID" || (balanceAmount !== undefined && balanceAmount <= 0);
        const newStatus = isSettled ? "settled" : "pending";

        // Update customer_balances
        const { data: cbRecord } = await supabase
          .from("customer_balances")
          .select("*")
          .or(`invoice_id.eq.${invoiceId},id.eq.${invoiceId}`)
          .maybeSingle();

        if (cbRecord) {
          const tot = Number(cbRecord.total_amount || 0);
          const newPaid = paymentStatus === "PAID" ? tot : (paidAmount !== undefined ? paidAmount : Number(cbRecord.paid_amount || 0));
          const newBal = paymentStatus === "PAID" ? 0 : (balanceAmount !== undefined ? balanceAmount : Math.max(0, tot - newPaid));
          await supabase
            .from("customer_balances")
            .update({
              paid_amount: newPaid,
              balance_amount: newBal,
              status: newStatus,
              settlement_note: notes || cbRecord.settlement_note,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cbRecord.id);
        }

        // Also update vending_sales_log
        const { data: vslRecord } = await supabase
          .from("vending_sales_log")
          .select("id, custom_fields, expected_amount, rate_per_kg, weight_kg, amount_paid")
          .or(`custom_fields->>balance_ref_id.eq.${invoiceId},id.eq.${invoiceId}`)
          .maybeSingle();

        if (vslRecord) {
          const cf = vslRecord.custom_fields || {};
          const exp = Number(cf.expected_amount || vslRecord.expected_amount || Math.round(Number(vslRecord.weight_kg || 0) * Number(vslRecord.rate_per_kg || 580)));
          const newPaid = paymentStatus === "PAID" ? exp : (paidAmount !== undefined ? paidAmount : Number(vslRecord.amount_paid || 0));
          const newBal = paymentStatus === "PAID" ? 0 : (balanceAmount !== undefined ? balanceAmount : Math.max(0, exp - newPaid));
          cf.balance_amount = newBal;
          cf.balance_status = newStatus;
          if (notes) cf.settlement_note = notes;
          await supabase
            .from("vending_sales_log")
            .update({
              amount_paid: newPaid,
              custom_fields: cf,
              updated_at: new Date().toISOString(),
            })
            .eq("id", vslRecord.id);
        }

        return NextResponse.json({ success: true, message: "Khata balance updated successfully", invoiceId });
      }

      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const existingData = typeof row.data === "object" ? row.data : JSON.parse(row.data || "{}");
    const newName = name || customerName || existingData.name || existingData.customerName;
    const newPhone = phone || customerPhone || existingData.phone || existingData.customerPhone;
    const grandTot = existingData.tot ?? existingData.grandTotal ?? 0;

    let updatedPaid = paidAmount !== undefined ? paidAmount : existingData.paidAmount;
    let updatedBalance = balanceAmount !== undefined ? balanceAmount : existingData.balanceAmount;
    let updatedRefund = refundAmount !== undefined ? refundAmount : existingData.refundAmount;

    if (paymentStatus === "PAID") {
      updatedPaid = grandTot;
      updatedBalance = 0;
      updatedRefund = 0;
    } else if (paymentStatus === "PAYMENT DUE") {
      updatedPaid = 0;
      updatedBalance = grandTot;
      updatedRefund = 0;
    }

    const updatedData = {
      ...existingData,
      name: newName,
      customerName: newName,
      phone: newPhone,
      customerPhone: newPhone,
      address: address !== undefined ? address : existingData.address,
      paymentStatus: paymentStatus || existingData.paymentStatus,
      paymentId: paymentId !== undefined ? paymentId : existingData.paymentId,
      paymentMethod: paymentMethod || existingData.paymentMethod,
      paidAmount: updatedPaid,
      balanceAmount: updatedBalance,
      refundAmount: updatedRefund,
      notes: notes !== undefined ? notes : existingData.notes,
      paidAt: paymentStatus === "PAID" ? (existingData.paidAt || new Date().toISOString()) : existingData.paidAt,
      isExpired: reactivate ? false : (isExpired !== undefined ? isExpired : existingData.isExpired),
      ts: reactivate ? Date.now() : existingData.ts,
    };

    const { error: updateErr } = await supabase
      .from("invoices")
      .update({
        data: updatedData,
        expires_at: updatedData.isExpired
          ? new Date().toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", row.id);

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    // Sync remote_invoices_cache in app_settings
    try {
      const { data: cacheRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "remote_invoices_cache")
        .single();
      if (cacheRow?.value) {
        const cachedList = JSON.parse(cacheRow.value);
        const updatedCache = cachedList.map((item: any) => {
          const itemClean = String(item.id || "").replace(/\D/g, "");
          if (item.id === invoiceId || itemClean === cleanDigits || item.num === invoiceId) {
            return { ...item, data: updatedData, ...updatedData };
          }
          return item;
        });
        await supabase.from("app_settings").upsert({
          key: "remote_invoices_cache",
          value: JSON.stringify(updatedCache),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
      }
    } catch (_) {}

    return NextResponse.json({ success: true, invoice: updatedData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const cleanDigits = String(id).replace(/\D/g, "") || String(id);

    // 1. Fetch invoice row before deleting to extract payment link ID or QR ID
    let paymentLinkId: string | null = null;
    let qrId: string | null = null;
    let orderNum: string | null = null;

    try {
      const { data: row } = await supabase
        .from("invoices")
        .select("id, data")
        .or(`id.eq.${cleanDigits},id.eq.${id}`)
        .limit(1)
        .maybeSingle();

      if (row?.data) {
        const invData = typeof row.data === "object" ? row.data : JSON.parse(row.data || "{}");
        paymentLinkId = invData.paymentLinkId || null;
        qrId = invData.qrId || null;
        orderNum = invData.num || null;
      }
    } catch (_) {}

    // 2. If it has a Razorpay Payment Link, CANCEL & EXPIRE IT on Razorpay!
    if (paymentLinkId) {
      try {
        const rzp = getRazorpayClient();
        if (rzp) {
          await rzp.paymentLink.cancel(paymentLinkId);
          console.log("Successfully cancelled Razorpay payment link on invoice deletion:", paymentLinkId);
        }
      } catch (rzpErr: any) {
        console.warn("Notice: could not cancel Razorpay payment link:", rzpErr?.message || rzpErr);
      }
    }

    // 3. If it has an active Razorpay QR, CLOSE IT on Razorpay!
    if (qrId) {
      try {
        const rzp = getRazorpayClient();
        if (rzp) {
          await rzp.qrCode.close(qrId);
          console.log("Successfully closed Razorpay QR code on invoice deletion:", qrId);
        }
      } catch (qrErr: any) {
        console.warn("Notice: could not close Razorpay QR:", qrErr?.message || qrErr);
      }
    }

    // 4. Delete invoice from invoices table using service role client
    const { error: delErr } = await supabase
      .from("invoices")
      .delete()
      .or(`id.eq.${cleanDigits},id.eq.${id}`);

    if (delErr) {
      console.error("Error deleting invoice row:", delErr.message);
      return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
    }

    // 5. Update app_settings remote_invoices_cache
    try {
      const { data: cacheRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "remote_invoices_cache")
        .single();
      if (cacheRow?.value) {
        const cachedList = JSON.parse(cacheRow.value);
        const updatedCache = cachedList.filter((item: any) => {
          const itemClean = String(item.id || "").replace(/\D/g, "");
          return item.id !== id && itemClean !== cleanDigits && item.num !== orderNum;
        });
        await supabase.from("app_settings").upsert({
          key: "remote_invoices_cache",
          value: JSON.stringify(updatedCache),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
      }
    } catch (_) {}

    // 6. Vending log is manually maintained — never touch or delete vending_sales_log on invoice cancellation.

    return NextResponse.json({
      success: true,
      message: "Order cancelled and deleted successfully. Payment link/QR expired.",
      cancelledPaymentLink: paymentLinkId || undefined,
    });
  } catch (err: any) {
    console.error("DELETE /api/invoice exception:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
