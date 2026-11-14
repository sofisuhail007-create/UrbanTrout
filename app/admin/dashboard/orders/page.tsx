"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminClient";
import PaginationBar from "@/components/PaginationBar";
import FourUpInvoiceSheet, { InvoiceSlipData } from "@/components/FourUpInvoiceSheet";
import { generateFastQrDataUrl } from "@/lib/qrCode";

function orderToSlipData(order: Order, upi: string): InvoiceSlipData {
  let totalOrderedWeight = 0;
  let totalActualWeight = 0;

  const items = Array.isArray(order.items)
    ? order.items.map((i: any) => {
        const ordQty = typeof i.orderedWeight === "number" ? i.orderedWeight : (typeof i.orderedWeightKg === "number" ? i.orderedWeightKg : parseFloat(i.quantity) || 1);
        const actQty = typeof i.actualWeight === "number" ? i.actualWeight : (typeof i.weightKg === "number" ? i.weightKg : parseFloat(i.quantity) || 1);
        const rate = typeof i.price === "number" ? i.price : parseFloat(i.price) || 580;
        totalOrderedWeight += ordQty;
        totalActualWeight += actQty;
        return {
          name: i.name || "Fresh Rainbow Trout",
          quantity: actQty,
          weightKg: actQty,
          orderedWeightKg: ordQty,
          unit: i.unit || "Kg",
          price: rate,
          pricePerKg: rate,
          total: actQty * rate,
        };
      })
    : [];

  const isPaid =
    order.status === "processing" ||
    order.status === "out_for_delivery" ||
    order.status === "delivered";

  // Advance paid amount: if customer paid online in advance, default to original ordered total
  const paidAmount: number =
    (order as any).paid_amount !== undefined
      ? Number((order as any).paid_amount)
      : (order.items?.[0] as any)?.paidAmount !== undefined
      ? Number((order.items?.[0] as any).paidAmount)
      : (order.items?.[0] as any)?.originalTotal !== undefined
      ? Number((order.items?.[0] as any).originalTotal)
      : (isPaid ? Number(order.total) || 0 : 0);

  const grandTotal = Number(order.total) || 0;
  const refundAmount = paidAmount > grandTotal ? paidAmount - grandTotal : 0;
  const balanceAmount = grandTotal > paidAmount ? grandTotal - paidAmount : (isPaid ? 0 : grandTotal);

  return {
    invoiceNumber: String(order.order_number),
    orderNumber: order.order_number,
    customerName: order.customer_name || "Valued Customer",
    customerPhone: order.customer_phone || "",
    customerAddress: order.customer_address || "",
    customerLocality: order.customer_locality || "",
    createdAt: order.created_at,
    items,
    orderedWeight: totalOrderedWeight > 0 ? totalOrderedWeight : totalActualWeight,
    totalWeight: totalActualWeight,
    subtotal: order.subtotal || grandTotal,
    deliveryFee: order.delivery_fee,
    grandTotal,
    paidAmount,
    balanceAmount,
    refundAmount,
    paymentStatus: isPaid ? (refundAmount > 0 ? "REFUND DUE" : "PAID") : "PAYMENT DUE",
    paymentMethod: isPaid ? "Razorpay Online / UPI" : "Cash on Delivery",
    upiId: upi,
  };
}

const STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: "pending", label: "Awaiting Verification", color: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  { value: "processing", label: "Confirmed", color: "bg-[#161616] text-zinc-300 border-[#333333]" },
  { value: "out_for_delivery", label: "Out for Delivery", color: "bg-[#161616] text-zinc-300 border-[#333333]" },
  { value: "delivered", label: "Delivered", color: "bg-[#161616] text-zinc-200 border-[#333333]" },
  { value: "out_of_stock", label: "Out of Stock (Refund Due)", color: "bg-rose-500/10 text-rose-300 border-rose-500/20" },
  { value: "cancelled", label: "Cancelled", color: "bg-[#161616] text-zinc-500 border-[#333333]" },
];

function statusStyle(s: string) {
  return STATUSES.find((x) => x.value === s)?.color ?? "bg-slate-700 text-slate-400 border-slate-600";
}
function statusLabel(s: string) {
  return STATUSES.find((x) => x.value === s)?.label ?? s;
}

function getOrderMapsUrl(order: any): string | null {
  if (order.google_maps_url) {
    const qMatch = order.google_maps_url.match(/\?q=([0-9.-]+),([0-9.-]+)/);
    if (qMatch) {
      return `https://www.google.com/maps/dir/?api=1&destination=${qMatch[1]},${qMatch[2]}`;
    }
    return order.google_maps_url;
  }
  if (order.latitude && order.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`;
  }
  if (order.customer_address) {
    const qMatch = order.customer_address.match(/https:\/\/(?:maps\.google\.com\/\?q=|www\.google\.com\/maps\/dir\/\?api=1&destination=)([0-9.-]+),([0-9.-]+)/);
    if (qMatch) {
      return `https://www.google.com/maps/dir/?api=1&destination=${qMatch[1]},${qMatch[2]}`;
    }
    const match = order.customer_address.match(/https:\/\/(?:www\.)?google\.com\/maps[^\s]+|https:\/\/maps\.google\.com\/[^\s]+/);
    if (match) return match[0];
  }
  return null;
}

function getScheduledInfo(order: any): { isScheduled: boolean; date?: string; slot?: string; text?: string } {
  if (order.is_scheduled || order.scheduled_date || order.scheduled_slot) {
    const date = order.scheduled_date || "Scheduled";
    const slot = order.scheduled_slot || "";
    return {
      isScheduled: true,
      date,
      slot,
      text: slot ? `${date} (${slot})` : date,
    };
  }
  if (typeof order.customer_address === "string") {
    const match = order.customer_address.match(/\[SCHEDULED DELIVERY:\s*([^|]+)\s*\|\s*Slot:\s*([^\]]+)\]/i);
    if (match) {
      const date = match[1].trim();
      const slot = match[2].trim();
      return {
        isScheduled: true,
        date,
        slot,
        text: `${date} (${slot})`,
      };
    }
  }
  return { isScheduled: false };
}

function playSuccessChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (_) {}
}

export interface DispatchCountdown {
  isScheduled: boolean;
  schedText?: string;
  diffMs: number;
  isOverdue: boolean;
  formatted: string;
  elapsedMins: number;
  percent: number;
  urgency: "overdue" | "critical" | "expedite" | "ontrack";
}

function getDispatchCountdown(order: any, currentNow: number): DispatchCountdown {
  const sched = getScheduledInfo(order);
  const createdMs = new Date(order.created_at).getTime();
  const deadlineMs = createdMs + 120 * 60 * 1000; // 2 hour promise
  const diffMs = deadlineMs - currentNow;
  const isOverdue = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const hours = Math.floor(absMs / (1000 * 60 * 60));
  const mins = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((absMs % (1000 * 60)) / 1000);
  const formatted = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const elapsedMs = Math.max(0, currentNow - createdMs);
  const elapsedMins = Math.floor(elapsedMs / (60 * 1000));
  const percent = Math.min(100, Math.round((elapsedMs / (120 * 60 * 1000)) * 100));

  let urgency: "overdue" | "critical" | "expedite" | "ontrack" = "ontrack";
  if (isOverdue) urgency = "overdue";
  else if (diffMs <= 30 * 60 * 1000) urgency = "critical";
  else if (diffMs <= 60 * 60 * 1000) urgency = "expedite";
  else urgency = "ontrack";

  return {
    isScheduled: sched.isScheduled,
    schedText: sched.text,
    diffMs,
    isOverdue,
    formatted,
    elapsedMins,
    percent,
    urgency,
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"radar" | "table">("radar");
  const [now, setNow] = useState<number>(Date.now());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [printModalOrders, setPrintModalOrders] = useState<Order[] | null>(null);
  const [upiId, setUpiId] = useState<string>("50200105872271@hdfcbank");

  // Catch-Weight Scale Modal State
  const [scaleModalOrder, setScaleModalOrder] = useState<Order | null>(null);
  const [scaleActualWeight, setScaleActualWeight] = useState<string>("1.80");
  const [scaleAdvancePaid, setScaleAdvancePaid] = useState<string>("0");
  const [scalePaymentMode, setScalePaymentMode] = useState<"prepaid" | "cod">("prepaid");
  const [scaleSaving, setScaleSaving] = useState(false);

  // Instant Locked QR Modal State
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);
  const [qrAmount, setQrAmount] = useState<string>("0");
  const [qrMode, setQrMode] = useState<"razorpay" | "direct_upi">("razorpay");
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [posQrData, setPosQrData] = useState<{ qr_id: string; image_url: string; amount: number } | null>(null);
  const [posQrPaid, setPosQrPaid] = useState<boolean>(false);
  const [posQrPayment, setPosQrPayment] = useState<any>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [markingPaid, setMarkingPaid] = useState<boolean>(false);

  useEffect(() => {
    fetchOrders();
    fetchUpi();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function fetchUpi() {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "upi_id")
        .maybeSingle();
      if (data?.value) setUpiId(data.value);
    } catch (err) {
      console.warn("Could not load store UPI ID:", err);
    }
  }

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  // Active Dispatch Queue (Pending, Processing, Out for Delivery)
  // Sorted chronologically: oldest orders at the top so urgent deadlines are first
  const activeDispatchOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === "processing" || o.status === "out_for_delivery" || o.status === "pending")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [orders]);

  const overdueCount = useMemo(() => {
    return activeDispatchOrders.filter((o) => getDispatchCountdown(o, now).urgency === "overdue").length;
  }, [activeDispatchOrders, now]);

  const criticalCount = useMemo(() => {
    return activeDispatchOrders.filter((o) => getDispatchCountdown(o, now).urgency === "critical").length;
  }, [activeDispatchOrders, now]);

  const onTheRoadCount = useMemo(() => {
    return activeDispatchOrders.filter((o) => o.status === "out_for_delivery").length;
  }, [activeDispatchOrders]);

  // 1-Tap Solo-Operator WhatsApp alerts & Stage transitions
  const handleStartHarvest = async (order: Order) => {
    await updateStatus(order.id, "processing");
    playSuccessChime();
    const phone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);
    const name = order.customer_name || "Valued Customer";
    const orderNum = order.order_number;
    const msg = `Assalamu Alaikum ${name}! 🐟\n\nHarvesting has just started for your fresh trout order (#UT-WA-${orderNum}) at Urban Trout Farm!\n\nOur team is now netting your live trout and preparing clean pan-ready steaks. Express delivery is on track within our 2-hour window! 🛵`;
    if (phone) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleOutForDelivery = async (order: Order) => {
    await updateStatus(order.id, "out_for_delivery");
    playSuccessChime();
    const phone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);
    const name = order.customer_name || "Valued Customer";
    const orderNum = order.order_number;
    const locality = order.customer_locality || "your location";
    const msg = `Assalamu Alaikum ${name}! 🛵\n\nYour fresh trout order (#UT-WA-${orderNum}) is freshly packed in 0% melted-ice insulation and is OUT FOR DELIVERY!\n\nOur rider Suhail is on the road heading towards ${locality}. Please keep your phone reachable for a smooth handover.\n\nSee you soon! 🐟`;
    if (phone) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleMarkDelivered = async (order: Order) => {
    await updateStatus(order.id, "delivered");
    playSuccessChime();
    const phone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);
    const name = order.customer_name || "Valued Customer";
    const orderNum = order.order_number;
    const msg = `Assalamu Alaikum ${name}! ✨\n\nYour fresh trout order (#UT-WA-${orderNum}) has been successfully delivered!\n\nWe hope you and your family enjoy the fresh catch. If you loved our service, please take 10 seconds to share your review on Google:\nhttps://g.page/r/CTVKEpV62HMmECE/review\n\nThank you for trusting Urban Trout! 🐟`;
    if (phone) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const openScaleModal = (order: Order) => {
    const isPaid = order.status === "processing" || order.status === "out_for_delivery" || order.status === "delivered";
    const primaryItem = (order.items?.[0] as any) || { quantity: 1, price: 580 };
    const currentActWeight = primaryItem.actualWeight || primaryItem.weightKg || primaryItem.quantity || 1.0;
    const currentPaid = (order as any).paid_amount !== undefined
      ? (order as any).paid_amount
      : (primaryItem.paidAmount !== undefined
          ? primaryItem.paidAmount
          : (isPaid ? (primaryItem.originalTotal || order.total) : 0));

    setScaleModalOrder(order);
    setScaleActualWeight(String(currentActWeight));
    setScaleAdvancePaid(String(currentPaid));
    setScalePaymentMode(isPaid ? "prepaid" : "cod");
  };

  const saveScaleAdjustment = async (andPrint: boolean = false) => {
    if (!scaleModalOrder) return;
    setScaleSaving(true);
    try {
      const actWeight = parseFloat(scaleActualWeight) || 1.0;
      const advPaid = parseFloat(scaleAdvancePaid) || 0;
      const primaryItem = (scaleModalOrder.items?.[0] as any) || { name: "Fresh Rainbow Trout", price: 580, quantity: 1 };
      const originalOrdWeight = primaryItem.orderedWeight || primaryItem.orderedWeightKg || parseFloat(primaryItem.quantity) || actWeight;
      const rate = typeof primaryItem.price === "number" ? primaryItem.price : (parseFloat(primaryItem.price) || 580);
      const newSubtotal = Math.round(actWeight * rate);
      const deliveryFee = scaleModalOrder.delivery_fee || 0;
      const newTotal = newSubtotal + deliveryFee;

      const updatedItems = [
        {
          ...primaryItem,
          quantity: actWeight,
          actualWeight: actWeight,
          orderedWeight: originalOrdWeight,
          orderedWeightKg: originalOrdWeight,
          price: rate,
          total: newSubtotal,
          paidAmount: advPaid,
          originalTotal: advPaid > 0 ? advPaid : originalOrdWeight * rate,
        },
        ...(scaleModalOrder.items?.slice(1) || []),
      ];

      const newStatus = scalePaymentMode === "cod" ? "pending" : (scaleModalOrder.status === "pending" ? "processing" : scaleModalOrder.status);

      // Persist to Supabase via admin API
      await adminFetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: scaleModalOrder.id,
          status: newStatus,
          items: updatedItems,
          subtotal: newSubtotal,
          total: newTotal,
        }),
      });

      const updatedOrderObj: Order = {
        ...scaleModalOrder,
        status: newStatus as OrderStatus,
        items: updatedItems as any,
        subtotal: newSubtotal,
        total: newTotal,
        paid_amount: advPaid,
      } as any;

      // Update in state
      setOrders((prev) => prev.map((o) => (o.id === scaleModalOrder.id ? updatedOrderObj : o)));

      setScaleModalOrder(null);

      if (andPrint) {
        setPrintModalOrders([updatedOrderObj]);
      }
    } catch (err: any) {
      console.error("Scale adjustment error:", err);
      alert(`Could not save weight adjustment: ${err?.message || err}`);
    } finally {
      setScaleSaving(false);
    }
  };

  const handleOpenOrderQr = (order: Order, overrideAmount?: number) => {
    const isPaid = order.status === "processing" || order.status === "out_for_delivery" || order.status === "delivered";
    const primaryItem = (order.items?.[0] as any) || {};
    const paidAmt = (order as any).paid_amount !== undefined
      ? Number((order as any).paid_amount)
      : (primaryItem.paidAmount !== undefined
      ? Number(primaryItem.paidAmount)
      : (isPaid ? Number(order.total) || 0 : 0));
    const grandTotal = Number(order.total) || 0;
    const balanceDue = overrideAmount !== undefined ? overrideAmount : Math.max(0, grandTotal - paidAmt);
    const initialAmount = balanceDue > 0 ? balanceDue : grandTotal;

    setQrModalOrder(order);
    setQrAmount(String(initialAmount));
    setQrMode("razorpay");
    setQrError(null);
    setPosQrData(null);
    setPosQrPaid(false);
    setPosQrPayment(null);
    setCopiedLink(false);

    generateRazorpayQr(initialAmount, order);
  };

  const generateRazorpayQr = async (amt: number, ord: Order) => {
    if (amt <= 0) {
      setQrError("Amount must be greater than ₹0");
      return;
    }
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await fetch("/api/razorpay/pos-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          customerName: ord.customer_name || "Customer",
          customerPhone: ord.customer_phone || "",
          billNumber: ord.order_number,
        }),
      });
      const data = await res.json();
      if (data.success && data.qr_id && data.image_url) {
        setPosQrData({
          qr_id: data.qr_id,
          image_url: data.image_url,
          amount: data.amount,
        });
      } else {
        setQrMode("direct_upi");
        setQrError(data.error || "Razorpay Dynamic QR not available. Switched to Direct J&K Bank UPI.");
      }
    } catch (err: any) {
      setQrMode("direct_upi");
      setQrError("Connection issue. Switched to Direct J&K Bank UPI.");
    } finally {
      setQrLoading(false);
    }
  };

  const handleCloseQrModal = () => {
    if (posQrData?.qr_id && !posQrPaid) {
      fetch(`/api/razorpay/pos-qr?qr_id=${encodeURIComponent(posQrData.qr_id)}`, { method: "DELETE" }).catch(() => {});
    }
    setQrModalOrder(null);
    setPosQrData(null);
    setPosQrPaid(false);
    setPosQrPayment(null);
    setQrError(null);
  };

  // Polling for Razorpay POS QR payment
  useEffect(() => {
    if (!qrModalOrder || !posQrData?.qr_id || posQrPaid || qrMode !== "razorpay") {
      return;
    }

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/razorpay/pos-qr?qr_id=${encodeURIComponent(posQrData.qr_id)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.paid && isSubscribed) {
          setPosQrPaid(true);
          setPosQrPayment(data.payment);
          playSuccessChime();

          try {
            const newStatus = qrModalOrder.status === "pending" ? "processing" : qrModalOrder.status;
            await adminFetch("/api/order-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: qrModalOrder.id,
                status: newStatus,
                paid_amount: posQrData.amount,
                payment_status: "PAID",
                notes: `Paid ₹${posQrData.amount} via Razorpay Dynamic QR (${data.payment?.id || ""})`,
              }),
            });
            setOrders((prev) =>
              prev.map((o) =>
                o.id === qrModalOrder.id
                  ? ({ ...o, status: newStatus as OrderStatus, paid_amount: posQrData.amount } as any)
                  : o
              )
            );
          } catch (updateErr) {
            console.error("Failed to update order status on QR payment:", updateErr);
          }
        }
      } catch (err) {
        console.warn("Error polling POS QR:", err);
      }
    }, 2500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [qrModalOrder, posQrData?.qr_id, posQrPaid, qrMode]);

  const handleConfirmDirectUpiPaid = async () => {
    if (!qrModalOrder) return;
    setMarkingPaid(true);
    const amt = parseFloat(qrAmount) || Number(qrModalOrder.total) || 0;
    const newStatus = qrModalOrder.status === "pending" ? "processing" : qrModalOrder.status;
    try {
      await adminFetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: qrModalOrder.id,
          status: newStatus,
          paid_amount: amt,
          payment_status: "PAID",
          notes: `Paid ₹${amt} via Direct J&K Bank UPI (${upiId})`,
        }),
      });
      playSuccessChime();
      setOrders((prev) =>
        prev.map((o) =>
          o.id === qrModalOrder.id
            ? ({ ...o, status: newStatus as OrderStatus, paid_amount: amt } as any)
            : o
        )
      );
      setPosQrPaid(true);
    } catch (err: any) {
      alert(`Could not mark order as paid: ${err?.message || err}`);
    } finally {
      setMarkingPaid(false);
    }
  };

  const parsedQrAmount = parseFloat(qrAmount) || (qrModalOrder ? Number(qrModalOrder.total) : 0);
  const directUpiUri = qrModalOrder
    ? `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Aquaculture&tr=TERM${String(qrModalOrder.order_number)}&am=${parsedQrAmount.toFixed(2)}&cu=INR&tn=Order%20${qrModalOrder.order_number}`
    : "";
  const directUpiQrUrl = directUpiUri
    ? generateFastQrDataUrl(directUpiUri, { darkColor: "#000000", margin: 2 })
    : "";

  const handleShareQrOnWhatsApp = () => {
    if (!qrModalOrder) return;
    const cleanPhone = String(qrModalOrder.customer_phone || "").replace(/\D/g, "").slice(-10);
    const amountStr = `₹${parsedQrAmount.toLocaleString("en-IN")}`;
    const msg = `Hi ${qrModalOrder.customer_name}! 🐟\n\nYour Urban Trout Order #${qrModalOrder.order_number} is ready.\n\n*Amount Due: ${amountStr}* (Amount is locked)\n\nTap to pay with any UPI App (GPay / PhonePe / Paytm / mPay):\n${directUpiUri}\n\nOur UPI ID: ${upiId}\n\nThank you for choosing Urban Trout!`;
    const waUrl = cleanPhone.length === 10
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  const toggleSelectOrder = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = (pageOrders: Order[]) => {
    const pageIds = pageOrders.map((o) => o.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedOrderIds.has(id));
    if (allSelected) {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  async function updateStatus(id: string, status: OrderStatus) {
    setUpdating(id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    try {
      await adminFetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, status }),
      });
    } catch (err) {
      console.warn("Status update error:", err);
    } finally {
      setUpdating(null);
    }
  }

  async function handleDeleteOrder(id: string, orderNumber: number) {
    if (!window.confirm(`Are you sure you want to delete Order #${orderNumber}? This action cannot be undone.`)) {
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== id));
    try {
      const res = await adminFetch(`/api/order-status?orderId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json?.success) {
        throw new Error(json?.error || "Failed to delete order from server");
      }
    } catch (err: any) {
      console.error("Error deleting order:", err);
      alert(`Failed to delete order: ${err?.message || err}`);
      fetchOrders();
    }
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * 50;
    return filtered.slice(start, start + 50);
  }, [filtered, currentPage]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white font-['Space_Grotesk']">
              Dispatch Command &amp; Orders
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[11px] font-bold">
              ⚡ 2-Hour Express
            </span>
          </div>
          <p className="text-zinc-400 text-xs mt-0.5 font-mono">
            Solo Operator Radar • Live ticking timers, harvest status &amp; 1-tap route actions
          </p>
        </div>

        {/* View Switcher & 4-Up Print */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[#111111] p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setViewMode("radar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                viewMode === "radar"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span>2-Hour Radar ({activeDispatchOrders.length})</span>
              {criticalCount + overdueCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-zinc-200 text-zinc-950 shadow-sm font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">table_rows</span>
              <span>All Orders Table ({filtered.length})</span>
            </button>
          </div>

          {/* Quick Active Deliveries 4-Up button */}
          <button
            type="button"
            onClick={() => {
              const active = orders.filter(
                (o) => o.status === "processing" || o.status === "out_for_delivery" || o.status === "pending"
              );
              if (active.length === 0) {
                alert("No active delivery orders currently pending or out for delivery.");
                return;
              }
              setPrintModalOrders(active);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#161616] hover:bg-[#222222] border border-[#333333] text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Print all active deliveries on Canon MF244dw (4 slips per A4 sheet)"
          >
            <span className="material-symbols-outlined text-xs">print</span>
            <span>Print Active (4-Up)</span>
          </button>

          {/* Batch Print Selected Button */}
          {selectedOrderIds.size > 0 && (
            <button
              type="button"
              onClick={() => {
                const selected = orders.filter((o) => selectedOrderIds.has(o.id));
                setPrintModalOrders(selected);
              }}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Print selected orders on Canon MF244dw (4 slips per A4 sheet)"
            >
              <span className="material-symbols-outlined text-xs">print</span>
              <span>Print Selected ({selectedOrderIds.size})</span>
            </button>
          )}

          {selectedOrderIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedOrderIds(new Set())}
              className="px-2.5 py-1.5 rounded-lg bg-[#161616] hover:bg-[#222222] text-zinc-400 hover:text-zinc-200 text-xs font-medium border border-[#333333] transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {viewMode === "radar" ? (
        <div className="space-y-4">
          {/* Dispatch Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#0e0e0e] border border-zinc-800/80 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Active in Queue</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-white">{activeDispatchOrders.length}</span>
                <span className="text-xs text-zinc-500 font-mono">orders</span>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-2xl border transition-all space-y-1 ${
                criticalCount + overdueCount > 0
                  ? "bg-rose-950/20 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                  : "bg-[#0e0e0e] border-zinc-800/80"
              }`}
            >
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                {criticalCount + overdueCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                Critical (&lt; 30m) / Overdue
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono ${criticalCount + overdueCount > 0 ? "text-rose-400 font-extrabold" : "text-zinc-300"}`}>
                  {criticalCount + overdueCount}
                </span>
                <span className="text-xs text-zinc-500 font-mono">urgent</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0e0e0e] border border-zinc-800/80 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Rider on Road</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-cyan-400">{onTheRoadCount}</span>
                <span className="text-xs text-zinc-500 font-mono">in transit</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0e0e0e] border border-zinc-800/80 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Express Promise</span>
              <div className="flex items-baseline gap-2">
                <span className="text-base sm:text-lg font-bold font-mono text-emerald-400">120 Mins</span>
                <span className="text-[10px] text-zinc-500 font-mono">0% Ice Polybag</span>
              </div>
            </div>
          </div>

          {/* Radar Orders Queue */}
          {loading ? (
            <div className="text-center text-zinc-500 py-20 font-mono text-xs">Loading live dispatch queue...</div>
          ) : activeDispatchOrders.length === 0 ? (
            <div className="text-center text-zinc-400 py-16 px-4 bg-[#0a0a0a] rounded-2xl border border-zinc-800/80 space-y-3">
              <span className="text-4xl block">✨🐟</span>
              <h3 className="text-base font-bold text-white font-['Space_Grotesk']">All Caught Up! Zero Pending Deliveries</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto font-mono">
                All customer orders have been harvested, steak-prepped, and delivered within the 2-hour window. New incoming WhatsApp and checkout orders will appear here automatically with live countdown timers.
              </p>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium transition-all cursor-pointer"
              >
                Browse All Order History
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeDispatchOrders.map((order) => {
                const countdown = getDispatchCountdown(order, now);
                const primaryItem = (order.items?.[0] as any) || {};
                const orderedWt = primaryItem.orderedWeight || primaryItem.orderedWeightKg || parseFloat(primaryItem.quantity) || 1.0;
                const scaleWt = primaryItem.actualWeight || primaryItem.weightKg || orderedWt;
                const mapsUrl = getOrderMapsUrl(order);
                const cleanPhone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                      countdown.urgency === "overdue"
                        ? "bg-gradient-to-b from-rose-950/30 via-[#0a0a0a] to-[#0a0a0a] border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.18)]"
                        : countdown.urgency === "critical"
                        ? "bg-gradient-to-b from-amber-950/25 via-[#0a0a0a] to-[#0a0a0a] border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                        : countdown.urgency === "expedite"
                        ? "bg-gradient-to-b from-yellow-950/20 via-[#0a0a0a] to-[#0a0a0a] border-yellow-500/50"
                        : "bg-gradient-to-b from-emerald-950/15 via-[#0a0a0a] to-[#0a0a0a] border-emerald-500/40"
                    }`}
                  >
                    {/* Urgency Ticker Header */}
                    <div
                      className={`px-4 py-2.5 flex items-center justify-between border-b ${
                        countdown.urgency === "overdue"
                          ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                          : countdown.urgency === "critical"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                          : countdown.urgency === "expedite"
                          ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-300"
                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            countdown.urgency === "overdue" || countdown.urgency === "critical"
                              ? "bg-rose-500 animate-ping"
                              : "bg-emerald-400"
                          }`}
                        />
                        <span className="text-xs font-mono font-bold uppercase tracking-wider">
                          {countdown.isOverdue
                            ? `⚠️ OVERDUE BY ${countdown.formatted}`
                            : `${countdown.urgency === "critical" ? "🔥 CRITICAL" : countdown.urgency === "expedite" ? "⚡ EXPEDITE" : "🟢 ON TRACK"}: ${countdown.formatted} LEFT`}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono opacity-80">
                        {countdown.elapsedMins}m / 120m elapsed
                      </span>
                    </div>

                    {/* Elapsed Progress Bar */}
                    <div className="w-full bg-zinc-900 h-1">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          countdown.urgency === "overdue"
                            ? "bg-rose-500"
                            : countdown.urgency === "critical"
                            ? "bg-amber-500"
                            : countdown.urgency === "expedite"
                            ? "bg-yellow-400"
                            : "bg-emerald-400"
                        }`}
                        style={{ width: `${countdown.percent}%` }}
                      />
                    </div>

                    {/* Card Body */}
                    <div className="p-4 sm:p-5 space-y-4 flex-1">
                      {/* Customer & Location */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-zinc-400">#UT-WA-{order.order_number}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${statusStyle(order.status)}`}>
                              {statusLabel(order.status)}
                            </span>
                            {countdown.isScheduled && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
                                📅 {countdown.schedText}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-white mt-1">{order.customer_name}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                            <span className="material-symbols-outlined text-xs text-cyan-400">location_on</span>
                            <span className="text-zinc-300 font-medium">{order.customer_locality || "Srinagar Locality"}</span>
                            {order.customer_address && (
                              <span className="text-zinc-500 truncate max-w-[200px]" title={order.customer_address}>
                                • {order.customer_address.replace(/\[SCHEDULED DELIVERY:[^\]]+\]/i, "").trim()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Total & Paid status */}
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-bold font-mono text-cyan-300 block">
                            ₹{Number(order.total || 0).toLocaleString("en-IN")}
                          </span>
                          <span
                            className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold inline-block mt-0.5 ${
                              (order as any).payment_status === "PAID" || order.status === "processing" || order.status === "out_for_delivery"
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {(order as any).payment_status === "PAID" || order.status === "processing" || order.status === "out_for_delivery" ? "✓ PAID" : "COD / COLLECT"}
                          </span>
                        </div>
                      </div>

                      {/* Items & Scale Weight details */}
                      <div className="p-3 rounded-xl bg-black/60 border border-zinc-800/80 text-xs space-y-1.5 font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-300 font-semibold">{primaryItem.name || "Fresh Rainbow Trout"}</span>
                          <span className="text-cyan-400 font-bold">₹{primaryItem.price || 580}/Kg</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                          <span>
                            Ordered Wt: <strong className="text-zinc-200">{Number(orderedWt).toFixed(2)} Kg</strong>
                          </span>
                          <span>
                            Scale Catch Wt:{" "}
                            <strong className={primaryItem.actualWeight ? "text-emerald-300" : "text-zinc-500"}>
                              {primaryItem.actualWeight ? `${Number(scaleWt).toFixed(2)} Kg` : "Awaiting Scale"}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* 4-Stage Visual Pipeline */}
                      <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                        <div
                          className={`p-1.5 rounded-lg border ${
                            order.status === "pending" || order.status === "processing" || order.status === "out_for_delivery" || order.status === "delivered"
                              ? "bg-zinc-800 text-zinc-200 border-zinc-700"
                              : "bg-zinc-900/40 text-zinc-600 border-zinc-800"
                          }`}
                        >
                          1. Placed
                        </div>
                        <div
                          className={`p-1.5 rounded-lg border ${
                            order.status === "processing"
                              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold"
                              : order.status === "out_for_delivery" || order.status === "delivered"
                              ? "bg-zinc-800 text-zinc-200 border-zinc-700"
                              : "bg-zinc-900/40 text-zinc-600 border-zinc-800"
                          }`}
                        >
                          2. Harvest &amp; Steaks
                        </div>
                        <div
                          className={`p-1.5 rounded-lg border ${
                            order.status === "out_for_delivery"
                              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold"
                              : order.status === "delivered"
                              ? "bg-zinc-800 text-zinc-200 border-zinc-700"
                              : "bg-zinc-900/40 text-zinc-600 border-zinc-800"
                          }`}
                        >
                          3. Loaded on Bike
                        </div>
                        <div
                          className={`p-1.5 rounded-lg border ${
                            order.status === "delivered"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                              : "bg-zinc-900/40 text-zinc-600 border-zinc-800"
                          }`}
                        >
                          4. Delivered
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Bottom */}
                    <div className="p-4 bg-zinc-950/80 border-t border-zinc-800/80 space-y-2.5">
                      {/* Primary 1-Tap Workflow Transition Button */}
                      <div className="flex gap-2">
                        {order.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleStartHarvest(order)}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>🐟</span>
                            <span>Start Harvest &amp; Steaks (Notify WhatsApp)</span>
                          </button>
                        )}

                        {order.status === "processing" && (
                          <>
                            <button
                              type="button"
                              onClick={() => openScaleModal(order)}
                              className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-mono text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              title="Enter exact weight from weighing scale"
                            >
                              <span>⚖️</span>
                              <span>Catch Weight</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOutForDelivery(order)}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>🛵</span>
                              <span>Pack in 0% Ice &amp; Dispatch (Out for Delivery)</span>
                            </button>
                          </>
                        )}

                        {order.status === "out_for_delivery" && (
                          <button
                            type="button"
                            onClick={() => handleMarkDelivered(order)}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>✓</span>
                            <span>Mark Delivered &amp; Send Review Link</span>
                          </button>
                        )}
                      </div>

                      {/* Driver Quick Utilities */}
                      <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 flex items-center gap-1 transition-all"
                            title="Open Google Maps Turn-by-Turn Navigation"
                          >
                            <span className="material-symbols-outlined text-xs">navigation</span>
                            <span>Maps Route</span>
                          </a>
                        )}

                        {order.customer_phone && (
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1 transition-all"
                            title="Direct call customer"
                          >
                            <span className="material-symbols-outlined text-xs">call</span>
                            <span>Call</span>
                          </a>
                        )}

                        {cleanPhone && (
                          <a
                            href={`https://wa.me/91${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 flex items-center gap-1 transition-all"
                            title="Chat on WhatsApp"
                          >
                            <span className="material-symbols-outlined text-xs">chat</span>
                            <span>Chat</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenOrderQr(order)}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 flex items-center gap-1 transition-all cursor-pointer"
                          title="Generate Locked UPI QR for customer"
                        >
                          <span className="material-symbols-outlined text-xs">qr_code</span>
                          <span>Locked QR</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPrintModalOrders([order])}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1 transition-all cursor-pointer"
                          title="Print 4-Up Slip"
                        >
                          <span className="material-symbols-outlined text-xs">print</span>
                          <span>Slip</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {[{ value: "all", label: "All" }, ...STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              filter === s.value
                ? "bg-[#161616] text-zinc-100 border-zinc-600 shadow-sm"
                : "bg-[#0a0a0a] text-zinc-400 border-[#222222] hover:border-[#333333] hover:text-zinc-200"
            }`}
          >
            {s.label} {s.value !== "all" && `(${orders.filter((o) => o.status === s.value).length})`}
          </button>
        ))}
      </div>

      {/* Select All on Page bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between pb-1 px-1 text-xs text-zinc-400">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedOrderIds.has(o.id))}
              onChange={() => toggleSelectAllPage(paginatedOrders)}
              className="w-4 h-4 rounded border-[#333333] bg-[#0a0a0a] text-zinc-200 focus:ring-zinc-600 cursor-pointer"
            />
            <span className="hover:text-zinc-200 transition-colors font-medium">
              Select all on page ({paginatedOrders.length})
            </span>
          </label>
          {selectedOrderIds.size > 0 && (
            <span className="text-zinc-300 font-mono text-[11px]">
              {selectedOrderIds.size} order{selectedOrderIds.size > 1 ? "s" : ""} selected for 4-up printing
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center text-zinc-500 py-20 font-mono text-xs">Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-zinc-400 py-20 bg-[#0a0a0a] rounded-xl border border-[#222222]">
          <span className="material-symbols-outlined text-4xl mb-3 block text-zinc-600">receipt_long</span>
          No orders found.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedOrders.map((order) => (
            <div key={order.id} className="bg-[#0a0a0a] border border-[#222222] rounded-xl overflow-hidden hover:border-[#333333] transition-colors">
              {/* Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#161616]/30 transition-colors"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedOrderIds.has(order.id)}
                  onChange={() => {}}
                  onClick={(e) => toggleSelectOrder(order.id, e)}
                  className="w-4 h-4 rounded border-[#333333] bg-[#0a0a0a] text-zinc-200 focus:ring-zinc-600 cursor-pointer flex-shrink-0"
                  title="Select for batch 4-up printing"
                />
                <span className="text-zinc-500 text-xs font-mono w-10 flex-shrink-0">#{order.order_number}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{order.customer_name}</p>
                    {(() => {
                      const item = order.items?.[0] as any;
                      if (!item?.actualWeight || !item?.orderedWeight) return null;
                      const variance = item.orderedWeight - item.actualWeight;
                      if (Math.abs(variance) < 0.02) return null;
                      if (variance > 0) {
                        const refund = Math.round(variance * (item.price || 580));
                        return (
                          <span
                            title={`Ordered ${item.orderedWeight} Kg, Scale Wt ${item.actualWeight} Kg. Refund of ₹${refund} due to customer.`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161616] text-zinc-300 border border-[#333333] text-[10px] font-mono flex-shrink-0"
                          >
                            <span>Scale: {item.actualWeight.toFixed(2)} Kg (-₹{refund} Refund)</span>
                          </span>
                        );
                      } else {
                        const due = Math.round(Math.abs(variance) * (item.price || 580));
                        return (
                          <span
                            title={`Ordered ${item.orderedWeight} Kg, Scale Wt ${item.actualWeight} Kg. Extra ₹${due} due from customer.`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono flex-shrink-0"
                          >
                            <span>Scale: {item.actualWeight.toFixed(2)} Kg (+₹{due} Due)</span>
                          </span>
                        );
                      }
                    })()}
                    {(() => {
                      const sched = getScheduledInfo(order);
                      if (!sched.isScheduled) return null;
                      return (
                        <span
                          title={`Scheduled Delivery: ${sched.text}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161616] text-zinc-300 border border-[#333333] text-[10px] font-mono flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-[11px]">calendar_today</span>
                          <span className="truncate max-w-[130px] sm:max-w-none">{sched.text}</span>
                        </span>
                      );
                    })()}
                    {(() => {
                      const mapsUrl = getOrderMapsUrl(order);
                      if (!mapsUrl) return null;
                      return (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Google Maps Navigation"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161616] text-zinc-300 hover:text-white border border-[#333333] text-[11px] font-medium transition-colors flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-xs">near_me</span>
                          <span>Map</span>
                        </a>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-zinc-500 font-mono">+91 {order.customer_phone}</p>
                </div>
                <span className={`hidden sm:inline-flex text-[11px] px-2.5 py-0.5 rounded-full border font-mono uppercase font-medium ${statusStyle(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
                <span className="text-sm font-semibold text-white font-mono tabular-nums">₹{order.total?.toLocaleString("en-IN")}</span>

                {/* 1-Tap Instant Locked QR Button right on every row */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenOrderQr(order);
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#161616] hover:bg-[#222222] text-zinc-200 border border-[#333333] text-xs font-medium transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Instant Locked QR for doorstep COD collection"
                >
                  <span className="material-symbols-outlined text-xs">qr_code_2</span>
                  <span>QR</span>
                </button>

                {/* 1-Tap Weigh Button right on every row */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openScaleModal(order);
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#161616] hover:bg-[#222222] text-zinc-200 border border-[#333333] text-xs font-medium transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Weigh / Catch-Weight: Enter harvest scale weight"
                >
                  <span className="material-symbols-outlined text-xs">scale</span>
                  <span>Weigh</span>
                </button>

                {/* 1-Tap Canon Print Button right on every row */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPrintModalOrders([order]);
                  }}
                  className="px-2 py-1 rounded-md bg-[#161616] hover:bg-[#222222] text-zinc-200 border border-[#333333] text-xs font-medium transition-colors flex items-center gap-1 shrink-0 cursor-pointer hidden sm:flex"
                  title="Print 4-Up delivery slip on Canon MF244dw"
                >
                  <span className="material-symbols-outlined text-xs">print</span>
                  <span className="hidden md:inline">Print</span>
                </button>

                <span className="text-xs text-zinc-500 font-mono hidden md:block w-20 text-right">
                  {new Date(order.created_at).toLocaleDateString("en-IN")}
                </span>
                <span className="material-symbols-outlined text-zinc-500 text-base">
                  {expanded === order.id ? "expand_less" : "expand_more"}
                </span>
              </div>

              {/* Expanded */}
              {expanded === order.id && (
                <div className="border-t border-[#222222] px-4 py-4 bg-black/50 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-widest mb-1">Delivery Address</p>
                      <p className="text-slate-300">{order.customer_address}</p>
                      <p className="text-slate-500 text-xs">{order.customer_locality} — {order.customer_pincode}</p>
                      {(() => {
                        const sched = getScheduledInfo(order);
                        if (!sched.isScheduled) return null;
                        return (
                          <div className="mt-2.5 p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-xs text-cyan-200">
                            <span className="font-bold text-white block mb-0.5">📅 Scheduled Pre-Order Delivery</span>
                            <span>Date: <strong className="text-white">{sched.date}</strong></span>
                            {sched.slot && <span> | Slot: <strong className="text-emerald-400">{sched.slot}</strong></span>}
                          </div>
                        );
                      })()}
                      {(() => {
                        const mapsUrl = getOrderMapsUrl(order);
                        if (!mapsUrl) return null;
                        return (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-500/25 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">near_me</span>
                            🗺️ 1-Tap Google Maps (Navigate)
                          </a>
                        );
                      })()}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-slate-600 uppercase tracking-widest">Items Ordered</p>
                        <button
                          type="button"
                          onClick={() => openScaleModal(order)}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <span>⚖️ Adjust Scale Weight</span>
                        </button>
                      </div>
                      {(order.items ?? []).map((item: any, i) => {
                        const hasVariance = item.actualWeight && item.orderedWeight && Math.abs(item.actualWeight - item.orderedWeight) >= 0.02;
                        return (
                          <div key={i} className="text-slate-300 text-xs sm:text-sm py-0.5">
                            <div className="flex items-center justify-between">
                              <span>
                                {item.name} × {item.quantity} {item.unit || "Kg"} — ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                              </span>
                            </div>
                            {hasVariance && (
                              <p className="text-[11px] text-amber-400 font-mono mt-0.5">
                                Ordered: {item.orderedWeight} Kg → Harvest Scale: {item.actualWeight} Kg
                              </p>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-slate-500 text-xs mt-1">
                        Delivery: {order.delivery_fee === 0 ? "Free" : `₹${order.delivery_fee}`} · Zone: {order.delivery_zone ?? "—"}
                      </p>
                    </div>
                  </div>

                  {/* Status updater */}
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-widest mb-2">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <button
                          key={s.value}
                          disabled={order.status === s.value || updating === order.id}
                          onClick={() => updateStatus(order.id, s.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 ${
                            order.status === s.value ? s.color + " opacity-100" : "bg-slate-800 text-slate-400 border-[#333333] hover:border-slate-500"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions (Weigh/Scale + Print 4-Up + Navigate + WhatsApp + Delete) */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#222222]/80 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenOrderQr(order)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition-colors shadow-sm cursor-pointer"
                        title="Generate instant amount-locked UPI QR (Razorpay dynamic or Direct J&K Bank) for doorstep collection"
                      >
                        <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                        <span>⚡ Instant Locked QR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openScaleModal(order)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold hover:bg-amber-500/30 transition-colors shadow-sm cursor-pointer"
                        title="Enter actual harvested scale weight & reconcile customer refund or balance due"
                      >
                        <span>⚖️</span>
                        <span>Weigh / Catch-Weight</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPrintModalOrders([order])}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-colors shadow-sm cursor-pointer"
                        title="Print 4 slips on 1 A4 sheet using Canon MF244dw laser printer"
                      >
                        <span>🖨️</span>
                        <span>Print 4-Up Slip (Canon)</span>
                      </button>

                      {(() => {
                        const mapsUrl = getOrderMapsUrl(order);
                        if (!mapsUrl) return null;
                        return (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition-colors shadow-sm"
                          >
                            <span className="material-symbols-outlined text-base">near_me</span>
                            🗺️ 1-Tap Google Maps (Navigate)
                          </a>
                        );
                      })()}

                      {(() => {
                        const cleanPhone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);
                        const text = encodeURIComponent(`Hi ${order.customer_name}! Your Urban Trout order #${order.order_number} update:`);
                        const waUrl = cleanPhone.length === 10 ? `https://wa.me/91${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
                        return (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium hover:bg-green-500/25 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">chat</span>
                            WhatsApp Customer
                          </a>
                        );
                      })()}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(order.id, order.order_number)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                      Delete Order
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <PaginationBar
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={50}
          onPageChange={setCurrentPage}
          itemLabel="orders"
          themeColor="cyan"
          className="mt-4 rounded-xl border border-[#222222]/80"
        />
      </>
    )}
  </div>
)}

      {/* ─── CATCH-WEIGHT RECONCILIATION MODAL ─── */}
      {scaleModalOrder && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !scaleSaving) setScaleModalOrder(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain"
        >
          <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-[#333333]/80 rounded-2xl shadow-2xl p-5 sm:p-6 text-white my-auto max-h-[90dvh] overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#222222]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚖️</span>
                  <h3 className="text-lg font-bold text-white">Catch-Weight Scale Adjustment</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Order <span className="font-mono font-bold text-cyan-400">#{scaleModalOrder.order_number}</span> · {scaleModalOrder.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScaleModalOrder(null)}
                disabled={scaleSaving}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="py-4 space-y-4 text-sm">
              {(() => {
                const primaryItem = (scaleModalOrder.items?.[0] as any) || { name: "Fresh Rainbow Trout", price: 580, quantity: 1 };
                const originalOrdWeight = primaryItem.orderedWeight || primaryItem.orderedWeightKg || parseFloat(primaryItem.quantity) || 1.0;
                const rate = typeof primaryItem.price === "number" ? primaryItem.price : (parseFloat(primaryItem.price) || 580);
                const actWeight = parseFloat(scaleActualWeight) || 0;
                const deliveryFee = scaleModalOrder.delivery_fee || 0;
                const newSubtotal = Math.round(actWeight * rate);
                const newGrandTotal = newSubtotal + deliveryFee;
                const advPaid = parseFloat(scaleAdvancePaid) || 0;

                let refundAmount = 0;
                let balanceAmount = 0;

                if (scalePaymentMode === "prepaid") {
                  if (advPaid > newGrandTotal) {
                    refundAmount = advPaid - newGrandTotal;
                  } else if (newGrandTotal > advPaid) {
                    balanceAmount = newGrandTotal - advPaid;
                  }
                } else {
                  balanceAmount = newGrandTotal;
                }

                return (
                  <>
                    {/* Item and Ordered Weight Reference */}
                    <div className="p-3 rounded-xl bg-black/70 border border-[#222222] text-xs flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 block">Product Ordered</span>
                        <strong className="text-white text-sm">{primaryItem.name}</strong>
                        <span className="text-slate-400 block mt-0.5">Rate: <strong className="text-cyan-400">₹{rate}/Kg</strong></span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block">Ordered Weight</span>
                        <strong className="text-cyan-300 font-mono text-base">{originalOrdWeight.toFixed(2)} Kg</strong>
                        <span className="text-slate-500 block text-[11px]">
                          Est. Total: ₹{(originalOrdWeight * rate + deliveryFee).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Actual Scale Weight Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <span>⚖️ Actual Scale Weight (Kg)</span>
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                            Required from Weighing Scale
                          </span>
                        </label>
                        <span className="text-xs text-slate-400 font-mono font-bold">
                          {actWeight > 0 ? `${(actWeight * 1000).toFixed(0)} grams` : ""}
                        </span>
                      </div>

                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0.1"
                          max="50"
                          value={scaleActualWeight}
                          onChange={(e) => setScaleActualWeight(e.target.value)}
                          placeholder="e.g. 1.80"
                          className="w-full px-4 py-2.5 bg-black border border-[#333333] rounded-xl text-white font-mono text-lg font-bold focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        <span className="absolute right-3.5 text-sm font-bold text-slate-400 pointer-events-none">Kg</span>
                      </div>

                      {/* Quick presets */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
                        {["1.50", "1.75", "1.80", "1.85", "1.90", "2.00", "2.10", "2.20"].map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setScaleActualWeight(w)}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                              scaleActualWeight === w
                                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400"
                                : "bg-slate-800 text-slate-300 border-[#333333] hover:border-slate-500"
                            }`}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Payment Mode Selection */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        Customer Payment Status
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setScalePaymentMode("prepaid");
                            if (advPaid === 0) {
                              setScaleAdvancePaid(String(Math.round(originalOrdWeight * rate + deliveryFee)));
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            scalePaymentMode === "prepaid"
                              ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-200"
                              : "bg-black/60 border-[#222222] text-slate-400 hover:border-[#333333]"
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1">
                            <span>💳</span>
                            <span>Prepaid in Advance</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">Customer paid before harvest (Online / UPI)</p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setScalePaymentMode("cod");
                            setScaleAdvancePaid("0");
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                            scalePaymentMode === "cod"
                              ? "bg-amber-500/15 border-amber-500/60 text-amber-200"
                              : "bg-black/60 border-[#222222] text-slate-400 hover:border-[#333333]"
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1">
                            <span>💵</span>
                            <span>Pay on Delivery (COD)</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">Collect via Locked J&K Bank QR on delivery</p>
                        </button>
                      </div>
                    </div>

                    {/* If Prepaid: Advance Amount Input */}
                    {scalePaymentMode === "prepaid" && (
                      <div className="p-3 rounded-xl bg-black/60 border border-[#222222] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-300">
                            Advance Amount Received (₹)
                          </label>
                          <button
                            type="button"
                            onClick={() => setScaleAdvancePaid(String(Math.round(originalOrdWeight * rate + deliveryFee)))}
                            className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                          >
                            Reset to Original Total (₹{Math.round(originalOrdWeight * rate + deliveryFee)})
                          </button>
                        </div>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-sm font-bold text-slate-400 pointer-events-none">₹</span>
                          <input
                            type="number"
                            step="1"
                            value={scaleAdvancePaid}
                            onChange={(e) => setScaleAdvancePaid(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 bg-[#0a0a0a] border border-[#333333] rounded-lg text-white font-mono text-sm font-bold focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Real-time Calculation Summary Banner */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs px-2 py-1 text-slate-400">
                        <span>Actual Scale Value: {actWeight.toFixed(2)} Kg × ₹{rate}/Kg</span>
                        <span className="font-mono text-white font-semibold">₹{newSubtotal.toLocaleString("en-IN")}</span>
                      </div>
                      {deliveryFee > 0 && (
                        <div className="flex items-center justify-between text-xs px-2 py-0.5 text-slate-400">
                          <span>Delivery Fee:</span>
                          <span className="font-mono text-white font-semibold">₹{deliveryFee}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs px-2 py-1 border-t border-[#222222] text-slate-300 font-bold">
                        <span>Revised Net Bill Payable:</span>
                        <span className="font-mono text-cyan-300 text-sm">₹{newGrandTotal.toLocaleString("en-IN")}</span>
                      </div>

                      {/* OUTCOME 1: REFUND DUE */}
                      {scalePaymentMode === "prepaid" && refundAmount > 0 && (
                        <div className="p-3.5 rounded-xl bg-emerald-950/80 border-2 border-emerald-500 text-emerald-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                              <span>💵</span>
                              <span>Refund / Cash Back Due to Customer</span>
                            </span>
                            <span className="text-xl font-black font-mono text-emerald-300">
                              ₹{refundAmount.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-200/90 leading-tight">
                            Customer paid for {originalOrdWeight.toFixed(2)} Kg (₹{advPaid}), but actual scale weight is {actWeight.toFixed(2)} Kg (₹{newGrandTotal}).
                          </p>
                          <div className="mt-2 pt-2 border-t border-emerald-500/30 text-[11px] font-semibold text-emerald-100 flex items-center gap-1.5">
                            <span>🛵</span>
                            <span>Printed on slip: <strong>"Rider instruction: Please return ₹{refundAmount} cash/UPI to customer"</strong></span>
                          </div>
                        </div>
                      )}

                      {/* OUTCOME 2: BALANCE DUE (PREPAID DEFICIT) */}
                      {scalePaymentMode === "prepaid" && balanceAmount > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-950/80 border-2 border-amber-500 text-amber-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                              <span>⚠️</span>
                              <span>Extra Balance Due from Customer</span>
                            </span>
                            <span className="text-xl font-black font-mono text-amber-300">
                              ₹{balanceAmount.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-200/90 leading-tight">
                            Customer paid ₹{advPaid}, but scale weight is {actWeight.toFixed(2)} Kg (Total ₹{newGrandTotal}).
                          </p>
                          <div className="mt-2 pt-2 border-t border-amber-500/30 text-[11px] font-semibold text-amber-100 flex items-center gap-1.5">
                            <span>📱</span>
                            <span>Printed on slip: <strong>Locked J&K Bank QR for ₹{balanceAmount}</strong></span>
                          </div>
                        </div>
                      )}

                      {/* OUTCOME 3: PREPAID FULL MATCH */}
                      {scalePaymentMode === "prepaid" && refundAmount === 0 && balanceAmount === 0 && (
                        <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/50 text-blue-200 text-xs flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>✓</span>
                            <span>Exact match. Verified Paid in full (₹{newGrandTotal}).</span>
                          </div>
                          <span className="text-[11px] font-bold text-blue-300">No cash collection</span>
                        </div>
                      )}

                      {/* OUTCOME 4: COD / UNPAID */}
                      {scalePaymentMode === "cod" && (
                        <div className="p-3.5 rounded-xl bg-amber-950/80 border-2 border-amber-500 text-amber-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                              <span>⚠️</span>
                              <span>Full Amount Due on Delivery</span>
                            </span>
                            <span className="text-xl font-black font-mono text-amber-300">
                              ₹{balanceAmount.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-200/90 leading-tight">
                            Order is unpaid. 4-Up delivery bill will feature a <strong>Locked J&K Bank Dynamic UPI QR</strong> pre-filled with ₹{balanceAmount}.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const ord = scaleModalOrder;
                              setScaleModalOrder(null);
                              handleOpenOrderQr(ord, balanceAmount);
                            }}
                            className="w-full mt-2.5 py-1.5 px-3 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.01]"
                          >
                            <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                            <span>⚡ Collect ₹{balanceAmount} via Instant Locked QR</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#222222] flex items-center justify-end gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setScaleModalOrder(null)}
                disabled={scaleSaving}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveScaleAdjustment(false)}
                disabled={scaleSaving}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {scaleSaving ? "Saving..." : "Save Scale Weight"}
              </button>
              <button
                type="button"
                onClick={() => saveScaleAdjustment(true)}
                disabled={scaleSaving}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <span>🖨️</span>
                <span>{scaleSaving ? "Saving..." : "Save & Print 4-Up Slip"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4-UP BATCH INVOICE MODAL (CANON MF244DW) ─── */}
      {printModalOrders && printModalOrders.length > 0 && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintModalOrders(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="relative w-full max-w-4xl my-auto max-h-[90dvh] overflow-y-auto overscroll-contain">
            <FourUpInvoiceSheet
              invoices={printModalOrders.map((o) => orderToSlipData(o, upiId))}
              repeatSingle={printModalOrders.length === 1}
              onClose={() => setPrintModalOrders(null)}
              showControls={true}
            />
          </div>
        </div>
      )}

      {/* ─── INSTANT LOCKED UPI QR MODAL ─── */}
      {qrModalOrder && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !qrLoading) handleCloseQrModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain"
        >
          <div className="relative w-full max-w-md bg-[#0a0a0a] border border-[#333333]/80 rounded-2xl shadow-2xl p-5 sm:p-6 text-white my-auto max-h-[90dvh] overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#222222]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <h3 className="text-lg font-bold text-white">Instant Locked UPI QR</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Order <span className="font-mono font-bold text-cyan-400">#{qrModalOrder.order_number}</span> · {qrModalOrder.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseQrModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex gap-2 mt-4 p-1 bg-black/70 border border-[#222222] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setQrMode("razorpay");
                  if (!posQrData && !qrLoading) {
                    generateRazorpayQr(parsedQrAmount, qrModalOrder);
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  qrMode === "razorpay"
                    ? "bg-cyan-500 text-slate-950 shadow-md font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>⚡ Auto-Verify POS QR</span>
              </button>
              <button
                type="button"
                onClick={() => setQrMode("direct_upi")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  qrMode === "direct_upi"
                    ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🏦 Direct J&K Bank (0% Fee)</span>
              </button>
            </div>

            {/* Amount Banner */}
            <div className="mt-3.5 p-3 rounded-xl bg-black/90 border border-[#222222] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium uppercase tracking-wider">Locked Pay Amount</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xl font-black text-cyan-400 font-mono">
                    ₹{parsedQrAmount.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.5 rounded-full font-bold">
                    🔒 Locked
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={qrAmount}
                  onChange={(e) => setQrAmount(e.target.value)}
                  className="w-20 px-2 py-1 bg-slate-800 border border-[#333333] rounded-lg text-xs font-mono font-bold text-white text-right focus:outline-none focus:border-cyan-500"
                  placeholder="Amount"
                  title="Override collection amount if customer gives partial cash"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newAmt = parseFloat(qrAmount);
                    if (newAmt > 0 && qrModalOrder) {
                      if (qrMode === "razorpay") {
                        generateRazorpayQr(newAmt, qrModalOrder);
                      }
                    }
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                  title="Update QR amount"
                >
                  Update
                </button>
              </div>
            </div>

            {/* QR Code Presentation Box */}
            <div className="mt-4 flex flex-col items-center justify-center p-4 bg-black rounded-2xl border border-[#222222]">
              {posQrPaid ? (
                <div className="py-8 flex flex-col items-center justify-center text-center animate-fadeIn space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-3xl text-emerald-400 shadow-lg shadow-emerald-500/20">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-emerald-400">Payment Received & Verified!</h4>
                    <p className="text-xs text-slate-300 mt-1 font-mono">
                      ₹{parsedQrAmount.toLocaleString("en-IN")} Captured Successfully
                    </p>
                    {posQrPayment?.id && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Ref: {posQrPayment.id}</p>
                    )}
                  </div>
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-200">
                    Order #{qrModalOrder.order_number} marked as Paid & Verified in database.
                  </div>
                </div>
              ) : qrLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-400">Generating dynamic locked QR...</span>
                </div>
              ) : (
                <>
                  <div className="p-2 bg-white rounded-xl shadow-lg shadow-black/40">
                    <img
                      src={
                        qrMode === "razorpay" && posQrData?.image_url
                          ? posQrData.image_url
                          : directUpiQrUrl
                      }
                      alt="Locked UPI QR"
                      className="w-56 h-56 object-contain block rounded"
                    />
                  </div>

                  {/* Mode-specific status indicator */}
                  {qrMode === "razorpay" ? (
                    <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-xs text-cyan-300">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                      <span>Waiting for customer scan... (Auto-detects)</span>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-300">
                      <span className="material-symbols-outlined text-sm">lock</span>
                      <span>Direct J&K Bank · ₹{parsedQrAmount} locked in app</span>
                    </div>
                  )}

                  {/* Supported Apps */}
                  <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#222222]">Google Pay</span>
                    <span className="px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#222222]">PhonePe</span>
                    <span className="px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#222222]">Paytm</span>
                    <span className="px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#222222]">mPay</span>
                  </div>
                </>
              )}
            </div>

            {/* Error banner if any */}
            {qrError && (
              <p className="mt-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 leading-relaxed">
                ℹ️ {qrError}
              </p>
            )}

            {/* Action Buttons */}
            <div className="mt-4 pt-3 border-t border-[#222222] flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleShareQrOnWhatsApp}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:scale-[1.02] active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>WhatsApp Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(directUpiUri);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedLink ? "check" : "content_copy"}
                  </span>
                  <span>{copiedLink ? "Copied!" : "Copy UPI Link"}</span>
                </button>
              </div>

              {/* Direct UPI manual confirmation button */}
              {qrMode === "direct_upi" && !posQrPaid && (
                <button
                  type="button"
                  onClick={handleConfirmDirectUpiPaid}
                  disabled={markingPaid}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <span>✓</span>
                  <span>{markingPaid ? "Updating Order..." : `Customer Paid ₹${parsedQrAmount} (Confirm & Mark Paid)`}</span>
                </button>
              )}

              {posQrPaid && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const ord = qrModalOrder;
                      handleCloseQrModal();
                      if (ord) setPrintModalOrders([ord]);
                    }}
                    className="py-2.5 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🖨️</span>
                    <span>Print 4-Up Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseQrModal}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer"
                  >
                    Done / Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
