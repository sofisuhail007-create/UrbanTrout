/**
 * Utility for resolving and formatting Customer Khata / Vending Sales Log records
 * into standardized Executive Tax Invoices compatible with the invoice desk and A4 PDF generator.
 */

export function isUUID(str?: string | null): boolean {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

export function formatKhataAsInvoice(cb?: any, vsl?: any, fallbackId?: string) {
  const cf = vsl?.custom_fields || {};
  const num =
    cb?.invoice_id ||
    cf.balance_ref_id ||
    fallbackId ||
    `VL-${vsl?.entry_date ? vsl.entry_date.replace(/\D/g, "") : "LIVE"}-${vsl?.id ? vsl.id.slice(-4) : "9999"}`;

  const name = cb?.customer_name || cf.customer_name || "Counter Customer";
  const phone = cb?.customer_phone || cf.customer_phone || "";

  const weight = Number(vsl?.weight_kg || 0);
  const total = Number(cb?.total_amount || cf.expected_amount || vsl?.expected_amount || 0);
  const rate = Number(
    vsl?.rate_per_kg ||
      cf.effective_rate ||
      (weight > 0 && total > 0 ? Math.round(total / weight) : 580)
  );
  const paid = Number(cb?.paid_amount ?? vsl?.amount_paid ?? 0);
  const balance = Number(cb?.balance_amount ?? cf.balance_amount ?? Math.max(0, total - paid));
  const status = cb?.status || cf.balance_status || (balance <= 0 ? "settled" : "pending");
  const isSettled = balance <= 0 || status === "settled" || status === "waived_final";

  const productType = vsl?.product_type || "Gutted";
  const itemWeight =
    weight > 0 ? weight : total > 0 && rate > 0 ? Number((total / rate).toFixed(3)) : 1;

  const standardBaseRate = cf.standard_base_rate || 580;
  const standardTotal = cf.standard_expected || Math.round(itemWeight * standardBaseRate);
  const discountAmount = Number(vsl?.discount_amount || cf.discount_amount || 0);

  return {
    invoiceNumber: num,
    customerName: name,
    customerPhone: phone ? (phone.startsWith("+91") ? phone : `+91 ${phone}`) : "N/A",
    customerAddress: "Urban Trout Vending Center / Farm Counter",
    items: [
      {
        name: `Fresh Mountain Rainbow Trout (${productType})`,
        weightKg: itemWeight,
        orderedWeightKg: itemWeight,
        pricePerKg: rate,
        total: total,
        standardRate: standardBaseRate,
        standardTotal: standardTotal,
        discountAmount: discountAmount,
      },
    ],
    orderedWeight: itemWeight,
    totalWeight: itemWeight,
    subtotal: total,
    deliveryFee: 0,
    grandTotal: total,
    paidAmount: paid,
    balanceAmount: Math.max(0, balance),
    refundAmount: 0,
    balanceStatus: status,
    notes: cb?.settlement_note || vsl?.notes || "Vending Center Counter Credit / Khata Dispatch",
    createdAt: cb?.created_at
      ? new Date(cb.created_at).getTime()
      : vsl?.created_at
      ? new Date(vsl.created_at).getTime()
      : Date.now(),
    isKhata: true,
    isExpired: false,
    expiresInHours: 720, // Khata credit bills do not expire in 48h; they stay active until settled
    paymentStatus: isSettled ? "PAID" : "PAYMENT DUE",
    paymentMethod: vsl?.payment_mode || cb?.payment_method || "Credit (Khata)",
    razorpayPaymentLinkId: cb?.razorpay_payment_link_id || cf.razorpay_payment_link_id,
    razorpayPaymentLinkUrl: cb?.razorpay_payment_link_url || cf.razorpay_payment_link_url,
  };
}

/**
 * Searches customer_balances, vending_sales_log, and app_settings fallback
 * to find and assemble a full invoice for a given Khata reference ID.
 */
export async function findKhataInvoice(rawId: string, supabaseClient: any) {
  if (!rawId) return null;
  const id = rawId.trim();
  const upperId = id.toUpperCase();
  const vlId = upperId.startsWith("VL-") ? upperId : `VL-${upperId}`;

  // 1. Try customer_balances table
  try {
    let cbQuery = supabaseClient.from("customer_balances").select("*");
    if (isUUID(id)) {
      cbQuery = cbQuery.or(`id.eq.${id},invoice_id.eq.${id},invoice_id.eq.${upperId},invoice_id.eq.${vlId}`);
    } else {
      cbQuery = cbQuery.or(`invoice_id.eq.${id},invoice_id.eq.${upperId},invoice_id.eq.${vlId}`);
    }
    const { data: cbRow } = await cbQuery.limit(1).maybeSingle();

    if (cbRow) {
      let vslRow = null;
      try {
        const { data: vsl } = await supabaseClient
          .from("vending_sales_log")
          .select("*")
          .or(`custom_fields->>balance_ref_id.eq.${cbRow.invoice_id},id.eq.${cbRow.id}`)
          .limit(1)
          .maybeSingle();
        vslRow = vsl;
      } catch (_) {}

      return formatKhataAsInvoice(cbRow, vslRow, cbRow.invoice_id || id);
    }
  } catch (err) {
    console.warn("[khataInvoice] Error querying customer_balances:", err);
  }

  // 2. Try vending_sales_log table
  try {
    let vslQuery = supabaseClient.from("vending_sales_log").select("*");
    if (isUUID(id)) {
      vslQuery = vslQuery.or(`id.eq.${id},custom_fields->>balance_ref_id.eq.${id},custom_fields->>balance_ref_id.eq.${upperId},custom_fields->>balance_ref_id.eq.${vlId}`);
    } else {
      vslQuery = vslQuery.or(`custom_fields->>balance_ref_id.eq.${id},custom_fields->>balance_ref_id.eq.${upperId},custom_fields->>balance_ref_id.eq.${vlId}`);
    }
    let { data: vslRow } = await vslQuery.limit(1).maybeSingle();

    // Fuzzy match by last 4 characters of UUID if prefixed with VL-
    if (!vslRow && (upperId.startsWith("VL-") || vlId.startsWith("VL-"))) {
      const target = upperId.startsWith("VL-") ? upperId : vlId;
      const parts = target.split("-");
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.length >= 4) {
        const { data: vslFuzzy } = await supabaseClient
          .from("vending_sales_log")
          .select("*")
          .filter("id::text", "ilike", `%${lastPart}`)
          .limit(1)
          .maybeSingle();
        vslRow = vslFuzzy;
      }
    }

    if (vslRow) {
      let cbRow = null;
      try {
        const cfRef = vslRow.custom_fields?.balance_ref_id || id;
        const { data: cb } = await supabaseClient
          .from("customer_balances")
          .select("*")
          .or(`invoice_id.eq.${cfRef},id.eq.${vslRow.id}`)
          .limit(1)
          .maybeSingle();
        cbRow = cb;
      } catch (_) {}

      return formatKhataAsInvoice(cbRow, vslRow, vslRow.custom_fields?.balance_ref_id || id);
    }
  } catch (err) {
    console.warn("[khataInvoice] Error querying vending_sales_log:", err);
  }

  // 3. Fallback: app_settings customer_balances_data cache
  try {
    const { data: appData } = await supabaseClient
      .from("app_settings")
      .select("value")
      .eq("key", "customer_balances_data")
      .single();
    if (appData?.value) {
      const list = JSON.parse(appData.value);
      if (Array.isArray(list)) {
        const match = list.find(
          (x: any) =>
            x.invoice_id === id ||
            x.invoice_id === upperId ||
            x.invoice_id === vlId ||
            x.id === id
        );
        if (match) {
          return formatKhataAsInvoice(match, undefined, match.invoice_id || id);
        }
      }
    }
  } catch (_) {}

  return null;
}
