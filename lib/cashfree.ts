import crypto from "crypto";

export const CASHFREE_API_VERSION = "2023-08-01";

export function getCashfreeMode(): "production" | "sandbox" {
  const mode = (
    process.env.CASHFREE_MODE ||
    process.env.NEXT_PUBLIC_CASHFREE_MODE ||
    "production"
  )
    .trim()
    .toLowerCase();
  return mode === "sandbox" || mode === "test" ? "sandbox" : "production";
}

export function getCashfreeBaseUrl(): string {
  return getCashfreeMode() === "sandbox"
    ? "https://sandbox.cashfree.com/pg"
    : "https://api.cashfree.com/pg";
}

export function getCashfreeCredentials() {
  const appId = (process.env.CASHFREE_APP_ID || "").trim();
  const secretKey = (process.env.CASHFREE_SECRET_KEY || "").trim();
  const webhookSecret = (process.env.CASHFREE_WEBHOOK_SECRET || secretKey).trim();
  return { appId, secretKey, webhookSecret };
}

export interface CashfreeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

export async function cashfreeFetch<T = any>(
  apiPath: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; timeoutMs?: number } = {}
): Promise<CashfreeFetchResult<T>> {
  const { appId, secretKey } = getCashfreeCredentials();
  if (!appId || !secretKey) {
    throw new Error("Cashfree credentials missing on server (CASHFREE_APP_ID / CASHFREE_SECRET_KEY)");
  }

  const baseUrl = getCashfreeBaseUrl();
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const method = options.method || "GET";
  const timeoutMs = options.timeoutMs || 12000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}${normalizedPath}`, {
      method,
      headers: {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": CASHFREE_API_VERSION,
        "Content-Type": "application/json",
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let parsed: any = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    return {
      ok: res.ok,
      status: res.status,
      data: parsed as T,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verifies Cashfree PG v2 webhook HMAC-SHA256 signature:
 * Base64(HMAC-SHA256(webhookSecret, timestamp + rawBody))
 */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const { webhookSecret } = getCashfreeCredentials();
  if (!webhookSecret || !signature || !timestamp) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}${rawBody}`)
    .digest("base64");

  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(signature.trim());
  if (expectedBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

export function extractCashfreeLinkSlug(linkUrl?: string | null): string | null {
  if (!linkUrl) return null;
  const match = String(linkUrl).match(/\/links\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

export function normalizeIndianPhone(phone?: string | null, fallback = "9999999999"): string {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  if (digits.length === 10 && !/^(.)\1{7,}$/.test(digits)) {
    return digits;
  }
  return fallback;
}

export interface CashfreeOrderPayment {
  cf_payment_id?: string | number;
  order_id?: string;
  order_amount?: number;
  payment_amount?: number;
  payment_currency?: string;
  payment_status?: string;
  payment_time?: string;
  payment_completion_time?: string;
  payment_group?: string;
  bank_reference?: string;
  payment_message?: string;
  payment_method?: {
    upi?: { channel?: string; upi_id?: string };
    netbanking?: { netbanking_bank_code?: string; netbanking_bank_name?: string };
    card?: { card_network?: string; card_type?: string; card_number?: string; card_bank_name?: string };
    wallet?: { provider?: string };
  };
}

export async function getCashfreeOrder(orderId: string) {
  return cashfreeFetch(`/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export async function getCashfreeOrderPayments(orderId: string) {
  return cashfreeFetch<CashfreeOrderPayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`, {
    method: "GET",
  });
}

export async function getCashfreePaymentLink(linkId: string) {
  return cashfreeFetch(`/links/${encodeURIComponent(linkId)}`, { method: "GET" });
}

export async function getCashfreeLinkOrders(linkId: string) {
  return cashfreeFetch<Array<{ order_id: string; order_amount?: number; order_status?: string }>>(
    `/links/${encodeURIComponent(linkId)}/orders`,
    { method: "GET" }
  );
}

export async function cancelCashfreePaymentLink(linkId: string) {
  return cashfreeFetch(`/links/${encodeURIComponent(linkId)}/cancel`, {
    method: "POST",
    body: {},
  });
}

/**
 * Resolves the first SUCCESS payment (or latest payment) for a Cashfree order or payment link.
 */
export async function resolveCashfreeLinkPayment(linkId: string): Promise<{
  linkData: any;
  isPaid: boolean;
  isCancelled: boolean;
  isExpired: boolean;
  paidAmount: number;
  payment: {
    id: string;
    order_id?: string;
    amount: number;
    method: string;
    vpa: string | null;
    bank_reference: string | null;
    captured_at: string | null;
  } | null;
}> {
  const linkRes = await getCashfreePaymentLink(linkId);
  if (!linkRes.ok) {
    throw new Error(linkRes.data?.message || `Failed to fetch Cashfree link (${linkRes.status})`);
  }

  const linkData = linkRes.data || {};
  const statusStr = String(linkData.link_status || "").toUpperCase();
  const paidAmt = Number(linkData.link_amount_paid || 0);
  const isPaid = statusStr === "PAID" || paidAmt > 0;
  const isCancelled = statusStr === "CANCELLED";
  const isExpired = statusStr === "EXPIRED";

  let payment: {
    id: string;
    order_id?: string;
    amount: number;
    method: string;
    vpa: string | null;
    bank_reference: string | null;
    captured_at: string | null;
  } | null = null;

  if (isPaid) {
    let cfPaymentId = `cf_${linkId}`;
    let cfOrderId: string | undefined;
    let method = "UPI";
    let vpa: string | null = null;
    let bankRef: string | null = null;
    let capturedAt: string | null = new Date().toISOString();

    try {
      const ordersRes = await getCashfreeLinkOrders(linkId);
      const ordersList = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const paidOrder = ordersList.find((o) => String(o.order_status || "").toUpperCase() === "PAID") || ordersList[0];
      if (paidOrder?.order_id) {
        cfOrderId = paidOrder.order_id;
        const payRes = await getCashfreeOrderPayments(paidOrder.order_id);
        const payList = Array.isArray(payRes.data) ? payRes.data : [];
        const successPay =
          payList.find((p) => String(p.payment_status || "").toUpperCase() === "SUCCESS") || payList[0];
        if (successPay) {
          if (successPay.cf_payment_id) cfPaymentId = String(successPay.cf_payment_id);
          method = successPay.payment_group || (successPay.payment_method?.upi ? "upi" : "online");
          vpa = successPay.payment_method?.upi?.upi_id || null;
          bankRef = successPay.bank_reference || null;
          capturedAt = successPay.payment_completion_time || successPay.payment_time || capturedAt;
        }
      }
    } catch {
      // Non-fatal; fallback to link-level paid metadata
    }

    payment = {
      id: cfPaymentId,
      order_id: cfOrderId,
      amount: paidAmt || Number(linkData.link_amount || 0),
      method,
      vpa,
      bank_reference: bankRef,
      captured_at: capturedAt,
    };
  }

  return {
    linkData,
    isPaid,
    isCancelled,
    isExpired,
    paidAmount: paidAmt || Number(linkData.link_amount || 0),
    payment,
  };
}
