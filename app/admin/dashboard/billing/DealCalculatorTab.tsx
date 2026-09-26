"use client";

import React, { useState, useEffect, useMemo } from "react";
import PaginationBar from "@/components/PaginationBar";
import { adminFetch } from "@/lib/adminClient";
import CustomerAutocompleteInput, { DbCustomer } from "./CustomerAutocompleteInput";

export interface DealProduct {
  id: string;
  name: string;
  pricePerKg: number;
  unit: string;
}

export interface DealDeskItem {
  id: string;
  productId: string;
  productName: string;
  weightKg: number;
  standardRate: number;
  standardTotal: number;
  dealRate: number;
  dealTotal: number;
  discountAmount: number;
  isCustomRate?: boolean;
}

export interface BargainDealItem {
  id: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  productId: string;
  productName: string;
  weightKg: number;
  standardRate: number;
  standardTotal: number;
  dealTotal: number;
  effectiveRate: number;
  discountAmount: number;
  discountPercent: number;
  lossPerKg: number;
  qrEngine: "soundbox" | "razorpay";
  qrId?: string | null;
  status: "PENDING" | "PAID";
  paymentId?: string | null;
  paymentLinkId?: string | null;
}

interface DealCalculatorTabProps {
  products: DealProduct[];
  activeScaleWeight?: string;
  upiId: string;
  speakPaymentAnnouncement: (amount: number, channel: string, customerName?: string) => void;
  playSuccessChime: () => void;
  onPushDealToBill: (deal: {
    productId: string;
    productName: string;
    weightKg: number;
    dealRatePerKg: number;
    dealTotal: number;
    standardRatePerKg: number;
    discountAmount: number;
    customerName: string;
    customerPhone: string;
    items?: Array<{
      productId: string;
      productName: string;
      weightKg: number;
      dealRatePerKg: number;
      dealTotal: number;
      standardRatePerKg: number;
      discountAmount: number;
    }>;
  }) => void;
  onSwitchTab: (tab: "pos" | "remote_orders" | "deal_calculator") => void;
  customers?: DbCustomer[];
  loadingCustomers?: boolean;
}

const DEALS_STORAGE_KEY = "ut_pos_bargain_deals_ledger_v1";

export default function DealCalculatorTab({
  products,
  activeScaleWeight,
  upiId,
  speakPaymentAnnouncement,
  playSuccessChime,
  onPushDealToBill,
  onSwitchTab,
  customers = [],
  loadingCustomers = false,
}: DealCalculatorTabProps) {
  // ─── 1. CORE CALCULATOR INPUT STATE & CLUBBED MULTI-ITEM STATE ───
  const [dealItems, setDealItems] = useState<DealDeskItem[]>(() => {
    const p = products[0] || { id: "gutted-trout", name: "Premium Gutted Rainbow Trout", pricePerKg: 580, unit: "Kg" };
    const initialWeight = Math.max(0.1, parseFloat(activeScaleWeight || "2.0") || 2.0);
    const stdRate = p.pricePerKg || 580;
    const defDealRate = stdRate > 20 ? stdRate - 20 : stdRate;
    return [
      {
        id: "deal-1",
        productId: p.id,
        productName: p.name,
        weightKg: initialWeight,
        standardRate: stdRate,
        standardTotal: Math.round(initialWeight * stdRate),
        dealRate: defDealRate,
        dealTotal: Math.round(initialWeight * defDealRate),
        discountAmount: Math.max(0, Math.round(initialWeight * stdRate) - Math.round(initialWeight * defDealRate)),
        isCustomRate: false,
      },
    ];
  });
  const [activeDealItemId, setActiveDealItemId] = useState<string>("deal-1");

  const activeDealItem = useMemo(() => {
    return dealItems.find((i) => i.id === activeDealItemId) || dealItems[0];
  }, [dealItems, activeDealItemId]);

  const [selectedProductId, setSelectedProductId] = useState<string>(
    activeDealItem?.productId || products[0]?.id || "gutted-trout"
  );
  const [customStandardRate, setCustomStandardRate] = useState<string>("");
  const [isCustomRateActive, setIsCustomRateActive] = useState<boolean>(false);

  const [weightStr, setWeightStr] = useState<string>(
    activeDealItem ? String(activeDealItem.weightKg) : activeScaleWeight || "2.0"
  );

  // Negotiation input states & mode
  const [activeInputMode, setActiveInputMode] = useState<"total" | "rate" | "percent" | "flat">("total");
  const [dealTotalStr, setDealTotalStr] = useState<string>(activeDealItem ? String(activeDealItem.dealTotal) : "");
  const [dealRateStr, setDealRateStr] = useState<string>(activeDealItem ? String(activeDealItem.dealRate) : "");
  const [discountPercentStr, setDiscountPercentStr] = useState<string>("");
  const [flatDiscountStr, setFlatDiscountStr] = useState<string>("");

  // Customer details
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");

  // ─── 2. LOCKED QR ENGINE STATE (DEFAULT: J&K BANK SOUNDBOX) ───
  const [qrEngine, setQrEngine] = useState<"soundbox" | "razorpay">("soundbox");
  const [rzpQrId, setRzpQrId] = useState<string | null>(null);
  const [rzpQrImageUrl, setRzpQrImageUrl] = useState<string | null>(null);
  const [rzpQrLoading, setRzpQrLoading] = useState<boolean>(false);
  const [rzpQrError, setRzpQrError] = useState<string | null>(null);

  // Active generated deal status
  const [activeDealNumber, setActiveDealNumber] = useState<string>("");
  const [isDealPaid, setIsDealPaid] = useState<boolean>(false);
  const [dealPaymentRef, setDealPaymentRef] = useState<string | null>(null);
  const [customerDisplayOpen, setCustomerDisplayOpen] = useState<boolean>(false);

  // WhatsApp & Link Sharing
  const [waLinkLoading, setWaLinkLoading] = useState<boolean>(false);
  const [activePaymentLink, setActivePaymentLink] = useState<string | null>(null);

  // ─── 3. TODAY'S BARGAIN DEALS LEDGER STATE ───
  const [dealsLedger, setDealsLedger] = useState<BargainDealItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(DEALS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (_) {}
    }
    return [];
  });

  // Save ledger to local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(DEALS_STORAGE_KEY, JSON.stringify(dealsLedger.slice(0, 100)));
      } catch (_) {}
    }
  }, [dealsLedger]);

  // ─── PAGINATION (50 entries/page) ───
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_PAGE_SIZE = 50;

  const paginatedDealsLedger = useMemo(() => {
    const start = (ledgerPage - 1) * LEDGER_PAGE_SIZE;
    return dealsLedger.slice(start, start + LEDGER_PAGE_SIZE);
  }, [dealsLedger, ledgerPage]);

  // Active product & standard rate for active deal item
  const activeProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const standardRate = isCustomRateActive && Number(customStandardRate) > 0
    ? Number(customStandardRate)
    : activeProduct?.pricePerKg || 750;

  const weight = Math.max(0, parseFloat(weightStr) || 0);
  const standardTotal = Math.round(weight * standardRate);

  // ─── MULTI-ITEM OPERATIONS ───
  const handleSelectDealItem = (id: string) => {
    setActiveDealItemId(id);
    const target = dealItems.find((i) => i.id === id);
    if (target) {
      setSelectedProductId(target.productId);
      setWeightStr(String(target.weightKg));
      setDealRateStr(String(target.dealRate));
      setDealTotalStr(String(target.dealTotal));
      setIsCustomRateActive(Boolean(target.isCustomRate));
      if (target.isCustomRate) {
        setCustomStandardRate(String(target.standardRate));
      } else {
        setCustomStandardRate("");
      }
      const disc = Math.max(0, target.standardTotal - target.dealTotal);
      setFlatDiscountStr(String(disc));
      setDiscountPercentStr(target.standardTotal > 0 ? ((disc / target.standardTotal) * 100).toFixed(1) : "0");
    }
  };

  const handleAddDealItem = (prodId?: string) => {
    const targetProd = prodId
      ? products.find((p) => p.id === prodId) || products[0]
      : products.find((p) => !dealItems.some((i) => i.productId === p.id)) || products[0];

    const stdRate = targetProd?.pricePerKg || 580;
    const defW = 1.0;
    const defDealRate = stdRate > 20 ? stdRate - 20 : stdRate;
    const defDealTotal = Math.round(defW * defDealRate);
    const defStdTotal = Math.round(defW * stdRate);

    const newId = `deal-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newItem: DealDeskItem = {
      id: newId,
      productId: targetProd?.id || "whole-trout",
      productName: targetProd?.name || "Whole Rainbow Trout",
      weightKg: defW,
      standardRate: stdRate,
      standardTotal: defStdTotal,
      dealRate: defDealRate,
      dealTotal: defDealTotal,
      discountAmount: Math.max(0, defStdTotal - defDealTotal),
      isCustomRate: false,
    };

    setDealItems((prev) => [...prev, newItem]);
    setActiveDealItemId(newId);
    setSelectedProductId(newItem.productId);
    setWeightStr(String(defW));
    setDealRateStr(String(defDealRate));
    setDealTotalStr(String(defDealTotal));
    setIsCustomRateActive(false);
    setCustomStandardRate("");
    setFlatDiscountStr(String(newItem.discountAmount));
    setDiscountPercentStr(defStdTotal > 0 ? ((newItem.discountAmount / defStdTotal) * 100).toFixed(1) : "0");
  };

  const handleRemoveDealItem = (id: string) => {
    if (dealItems.length <= 1) return;
    const remaining = dealItems.filter((i) => i.id !== id);
    setDealItems(remaining);
    if (remaining.length > 0) {
      handleSelectDealItem(remaining[0].id);
    }
  };

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    setIsCustomRateActive(false);
    const p = products.find((pr) => pr.id === prodId) || products[0];
    const newStdRate = p.pricePerKg || 580;
    setDealItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeDealItemId && item.id !== activeDealItem.id) return item;
        const stdTot = Math.round(item.weightKg * newStdRate);
        const dRate = item.dealRate > 0 && item.dealRate !== item.standardRate ? item.dealRate : (newStdRate > 20 ? newStdRate - 20 : newStdRate);
        const dTot = Math.round(item.weightKg * dRate);
        return {
          ...item,
          productId: p.id,
          productName: p.name,
          standardRate: newStdRate,
          standardTotal: stdTot,
          dealRate: dRate,
          dealTotal: dTot,
          discountAmount: Math.max(0, stdTot - dTot),
          isCustomRate: false,
        };
      })
    );
  };

  const handleWeightChange = (newWeightStr: string) => {
    setWeightStr(newWeightStr);
    const w = Math.max(0, parseFloat(newWeightStr) || 0);
    setDealItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeDealItemId && item.id !== activeDealItem.id) return item;
        const stdTot = Math.round(w * item.standardRate);
        const dTot = Math.round(w * item.dealRate);
        return {
          ...item,
          weightKg: w,
          standardTotal: stdTot,
          dealTotal: dTot,
          discountAmount: Math.max(0, stdTot - dTot),
        };
      })
    );
    const target = dealItems.find((i) => i.id === activeDealItemId || i.id === activeDealItem.id);
    if (target) {
      const dTot = Math.round(w * target.dealRate);
      setDealTotalStr(dTot > 0 ? String(dTot) : "");
    }
  };

  const handleCustomStandardRateChange = (rateValStr: string) => {
    setCustomStandardRate(rateValStr);
    const r = parseFloat(rateValStr) || 0;
    if (r > 0) {
      setDealItems((prev) =>
        prev.map((item) => {
          if (item.id !== activeDealItemId && item.id !== activeDealItem.id) return item;
          const stdTot = Math.round(item.weightKg * r);
          const disc = Math.max(0, stdTot - item.dealTotal);
          return {
            ...item,
            standardRate: r,
            standardTotal: stdTot,
            discountAmount: disc,
            isCustomRate: true,
          };
        })
      );
    }
  };

  const handleResetCustomRate = () => {
    setIsCustomRateActive(false);
    setCustomStandardRate("");
    const p = products.find((pr) => pr.id === selectedProductId) || products[0];
    const stdRate = p.pricePerKg || 580;
    setDealItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeDealItemId && item.id !== activeDealItem.id) return item;
        const stdTot = Math.round(item.weightKg * stdRate);
        const disc = Math.max(0, stdTot - item.dealTotal);
        return {
          ...item,
          standardRate: stdRate,
          standardTotal: stdTot,
          discountAmount: disc,
          isCustomRate: false,
        };
      })
    );
  };

  const handleEnableCustomRate = () => {
    setIsCustomRateActive(true);
    const initialCustom = customStandardRate || String(standardRate);
    setCustomStandardRate(initialCustom);
    handleCustomStandardRateChange(initialCustom);
  };

  // ─── 4. BI-DIRECTIONAL BARGAIN COMPUTATIONS FOR ACTIVE ITEM ───
  let dealTotal = 0;
  let dealRate = 0;
  let discountAmount = 0;
  let discountPercent = 0;
  let lossPerKg = 0;

  if (activeInputMode === "total") {
    dealTotal = Math.max(0, parseFloat(dealTotalStr) || 0);
    dealRate = weight > 0 ? dealTotal / weight : 0;
    discountAmount = Math.max(0, standardTotal - dealTotal);
    discountPercent = standardTotal > 0 ? (discountAmount / standardTotal) * 100 : 0;
    lossPerKg = Math.max(0, standardRate - dealRate);
  } else if (activeInputMode === "rate") {
    dealRate = Math.max(0, parseFloat(dealRateStr) || 0);
    dealTotal = Math.round(weight * dealRate);
    discountAmount = Math.max(0, standardTotal - dealTotal);
    discountPercent = standardTotal > 0 ? (discountAmount / standardTotal) * 100 : 0;
    lossPerKg = Math.max(0, standardRate - dealRate);
  } else if (activeInputMode === "percent") {
    discountPercent = Math.max(0, Math.min(100, parseFloat(discountPercentStr) || 0));
    discountAmount = Math.round(standardTotal * (discountPercent / 100));
    dealTotal = Math.max(0, standardTotal - discountAmount);
    dealRate = weight > 0 ? dealTotal / weight : 0;
    lossPerKg = Math.max(0, standardRate - dealRate);
  } else if (activeInputMode === "flat") {
    discountAmount = Math.max(0, parseFloat(flatDiscountStr) || 0);
    dealTotal = Math.max(0, standardTotal - discountAmount);
    discountPercent = standardTotal > 0 ? (discountAmount / standardTotal) * 100 : 0;
    dealRate = weight > 0 ? dealTotal / weight : 0;
    lossPerKg = Math.max(0, standardRate - dealRate);
  }

  // ─── COMBINED METRICS ACROSS ALL CLUBBED DEAL ITEMS ───
  const combinedWeight = useMemo(
    () => dealItems.reduce((sum, item) => sum + (Number(item.weightKg) || 0), 0),
    [dealItems]
  );
  const combinedStandardTotal = useMemo(
    () => dealItems.reduce((sum, item) => sum + (Number(item.standardTotal) || 0), 0),
    [dealItems]
  );
  const combinedDealTotal = useMemo(
    () => dealItems.reduce((sum, item) => sum + (Number(item.dealTotal) || 0), 0),
    [dealItems]
  );
  const combinedDiscountAmount = Math.max(0, combinedStandardTotal - combinedDealTotal);
  const combinedDiscountPercent = combinedStandardTotal > 0 ? (combinedDiscountAmount / combinedStandardTotal) * 100 : 0;
  const combinedEffectiveRate = combinedWeight > 0 ? combinedDealTotal / combinedWeight : 0;
  const combinedLossPerKg = combinedWeight > 0 ? combinedDiscountAmount / combinedWeight : 0;

  // Derive Soundbox UPI URI (J&K Bank Merchant Soundbox) for COMBINED deal total
  const terminalId = upiId.includes("@")
    ? `TERM${upiId.split("@")[0].replace(/^JKBMERC/, "")}`
    : "TERM00828895";
  const soundboxUpiUri = combinedDealTotal > 0
    ? `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Aquaculture&tr=${terminalId}&am=${combinedDealTotal}&mam=${combinedDealTotal}&cu=INR&tn=Deal-${activeDealNumber || Date.now().toString().slice(-4)}`
    : `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Aquaculture&tr=${terminalId}&cu=INR`;
  const soundboxQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(
    soundboxUpiUri
  )}&bgcolor=255-255-255&color=2-13-18&margin=2`;

  // ─── 5. INPUT SYNCHRONIZATION HELPERS ───
  const applyDealTotal = (totalVal: number) => {
    setActiveInputMode("total");
    setDealTotalStr(totalVal > 0 ? String(totalVal) : "");
    const dRate = weight > 0 && totalVal > 0 ? Math.round((totalVal / weight) * 10) / 10 : 0;
    if (weight > 0 && totalVal > 0) {
      setDealRateStr(dRate.toFixed(1));
      const disc = Math.max(0, standardTotal - totalVal);
      setDiscountPercentStr(((disc / standardTotal) * 100).toFixed(1));
      setFlatDiscountStr(String(disc));
    }
    setDealItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeDealItemId && item.id !== activeDealItem.id) return item;
        return {
          ...item,
          dealTotal: totalVal,
          dealRate: dRate,
          discountAmount: Math.max(0, item.standardTotal - totalVal),
        };
      })
    );
  };

  const applyDealRate = (rateVal: number) => {
    setActiveInputMode("rate");
    setDealRateStr(rateVal > 0 ? String(rateVal) : "");
    const tot = Math.round(weight * rateVal);
    setDealTotalStr(tot > 0 ? String(tot) : "");
    if (standardTotal > 0) {
      const disc = Math.max(0, standardTotal - tot);
      setDiscountPercentStr(((disc / standardTotal) * 100).toFixed(1));
      setFlatDiscountStr(String(disc));
    }
    setDealItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeDealItemId && item.id !== activeDealItem.id) return item;
        return {
          ...item,
          dealRate: rateVal,
          dealTotal: tot,
          discountAmount: Math.max(0, item.standardTotal - tot),
        };
      })
    );
  };

  const applyDiscountPercent = (pct: number) => {
    setActiveInputMode("percent");
    setDiscountPercentStr(String(pct));
    const disc = Math.round(standardTotal * (pct / 100));
    const tot = Math.max(0, standardTotal - disc);
    const dRate = weight > 0 ? Math.round((tot / weight) * 10) / 10 : 0;
    setDealTotalStr(String(tot));
    setFlatDiscountStr(String(disc));
    if (weight > 0) setDealRateStr(dRate.toFixed(1));
    setDealItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeDealItemId && item.id !== activeDealItem.id) return item;
        return {
          ...item,
          dealTotal: tot,
          dealRate: dRate,
          discountAmount: disc,
        };
      })
    );
  };

  const applyFlatDiscount = (cashOff: number) => {
    setActiveInputMode("flat");
    setFlatDiscountStr(String(cashOff));
    const tot = Math.max(0, standardTotal - cashOff);
    const dRate = weight > 0 ? Math.round((tot / weight) * 10) / 10 : 0;
    setDealTotalStr(String(tot));
    if (standardTotal > 0) {
      setDiscountPercentStr(((cashOff / standardTotal) * 100).toFixed(1));
    }
    if (weight > 0) setDealRateStr(dRate.toFixed(1));
    setDealItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeDealItemId && item.id !== activeDealItem.id) return item;
        return {
          ...item,
          dealTotal: tot,
          dealRate: dRate,
          discountAmount: cashOff,
        };
      })
    );
  };

  // Smart Rounding helpers
  const handleRoundToFifty = () => {
    if (standardTotal <= 0) return;
    const rounded = Math.floor(standardTotal / 50) * 50;
    applyDealTotal(rounded);
  };

  const handleRoundToHundred = () => {
    if (standardTotal <= 0) return;
    const rounded = Math.floor(standardTotal / 100) * 100;
    applyDealTotal(rounded);
  };

  // ─── 6. GENERATE SEPARATE LOCKED-IN QR ───
  const handleGenerateLockedQr = async (force = true) => {
    if (combinedDealTotal <= 0) return;
    const dealNum = `DEAL-${Date.now().toString().slice(-6)}`;
    setActiveDealNumber(dealNum);
    setIsDealPaid(false);
    setDealPaymentRef(null);

    if (qrEngine === "razorpay") {
      setRzpQrLoading(true);
      setRzpQrError(null);
      try {
        const res = await fetch("/api/razorpay/pos-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: combinedDealTotal,
            customerName: customerName.trim() || "Bargain Deal Customer",
            customerPhone: customerPhone.trim() || "N/A",
            billNumber: dealNum,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || "Could not generate locked Razorpay QR");
        }
        setRzpQrId(data.qr_id);
        setRzpQrImageUrl(data.image_url);
      } catch (err: any) {
        setRzpQrError(err.message || "Failed to generate locked QR");
      } finally {
        setRzpQrLoading(false);
      }
    }

    // Add entry to today's deals ledger
    const newDealItem: BargainDealItem = {
      id: dealNum,
      date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()),
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
      customerName: customerName.trim() || "Counter Customer",
      customerPhone: customerPhone.trim() || "N/A",
      productId: activeProduct.id,
      productName:
        dealItems.length > 1
          ? `${dealItems.length} Products Clubbed (${combinedWeight.toFixed(2)} Kg)`
          : activeProduct.name,
      weightKg: combinedWeight,
      standardRate: Math.round((combinedStandardTotal / (combinedWeight || 1)) * 100) / 100,
      standardTotal: combinedStandardTotal,
      dealTotal: combinedDealTotal,
      effectiveRate: Math.round(combinedEffectiveRate * 100) / 100,
      discountAmount: combinedDiscountAmount,
      discountPercent: Math.round(combinedDiscountPercent * 10) / 10,
      lossPerKg: Math.round(combinedLossPerKg * 100) / 100,
      qrEngine,
      status: "PENDING",
    };

    setDealsLedger((prev) => [newDealItem, ...prev.filter((d) => d.id !== dealNum)]);
  };

  // ─── 7. REAL-TIME AUTO-POLLER FOR RAZORPAY LOCKED QR (IF SELECTED) ───
  useEffect(() => {
    if (qrEngine !== "razorpay" || !rzpQrId || isDealPaid) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/razorpay/pos-qr?qr_id=${encodeURIComponent(rzpQrId)}`);
        const data = await res.json();
        if (data.success && data.paid) {
          setIsDealPaid(true);
          const payId = data.payment?.id || `pay_${Date.now()}`;
          setDealPaymentRef(payId);

          playSuccessChime();
          speakPaymentAnnouncement(combinedDealTotal, "Locked QR Deal", customerName);

          // Update ledger
          setDealsLedger((prev) =>
            prev.map((d) =>
              d.id === activeDealNumber
                ? { ...d, status: "PAID", paymentId: payId }
                : d
            )
          );

          clearInterval(interval);
        }
      } catch (err) {
        console.warn("Error polling locked QR status:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [qrEngine, rzpQrId, isDealPaid, combinedDealTotal, customerName, activeDealNumber]);

  // ─── 7b. PAYMENT LINK POLLER (for WhatsApp deals) ───
  useEffect(() => {
    const pendingWithLink = dealsLedger.filter(
      (d) => d.status === "PENDING" && d.paymentLinkId
    );
    if (pendingWithLink.length === 0) return;

    const interval = setInterval(async () => {
      for (const deal of pendingWithLink) {
        try {
          const res = await fetch(
            `/api/razorpay/payment-link?link_id=${encodeURIComponent(deal.paymentLinkId!)}`
          );
          const data = await res.json();
          if (data.success && data.paid) {
            const payId = data.payment?.id || `pl_paid_${Date.now()}`;
            playSuccessChime();
            speakPaymentAnnouncement(deal.dealTotal, "WhatsApp Deal", deal.customerName);
            setDealsLedger((prev) =>
              prev.map((d) =>
                d.id === deal.id
                  ? { ...d, status: "PAID", paymentId: payId }
                  : d
              )
            );
          }
        } catch (err) {
          console.warn("Error polling payment link status for deal", deal.id, err);
        }
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [dealsLedger, playSuccessChime, speakPaymentAnnouncement]);

  // Manual Soundbox Confirmation
  const handleConfirmSoundboxPaid = () => {
    setIsDealPaid(true);
    const payRef = `sbx_${Date.now().toString().slice(-6)}`;
    setDealPaymentRef(payRef);
    playSuccessChime();
    speakPaymentAnnouncement(combinedDealTotal, "Soundbox QR Deal", customerName);

    setDealsLedger((prev) =>
      prev.map((d) =>
        d.id === activeDealNumber
          ? { ...d, status: "PAID", paymentId: payRef }
          : d
      )
    );
  };

  // ─── 8. SEND WHATSAPP DEAL WITH LOCKED LINK ───
  const handleSendWhatsAppDeal = async () => {
    if (combinedDealTotal <= 0) return;
    setWaLinkLoading(true);
    try {
      const dealNum = activeDealNumber || `UT-DEAL-${Date.now().toString().slice(-5)}`;
      if (!activeDealNumber) setActiveDealNumber(dealNum);

      const cName = customerName.trim() || "Valued Customer";
      const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);
      const isGutted =
        activeProduct.name.toLowerCase().includes("gutted") &&
        !activeProduct.name.toLowerCase().includes("non");
      const prodType = isGutted ? "Gutted" : "Non Gutted";

      const itemsSummary =
        dealItems.length > 1
          ? `${dealItems.length} Products Clubbed (${combinedWeight.toFixed(2)} Kg total)`
          : `${weight} Kg ${activeProduct.name} (Special Agreed Price)`;

      let payUrl = "";
      let plId = "";
      if (activePaymentLink) {
        payUrl = activePaymentLink;
      } else {
        const res = await fetch("/api/razorpay/payment-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: combinedDealTotal,
            customerName: cName,
            customerPhone: cleanPhone,
            orderRef: dealNum,
            itemsSummary,
            channel: "WHATSAPP_DEAL",
            weightKg: combinedWeight,
            productType: prodType,
            dealRate: Math.round(combinedEffectiveRate * 100) / 100,
            standardRate: Math.round((combinedStandardTotal / (combinedWeight || 1)) * 100) / 100,
            standardTotal: combinedStandardTotal,
            discountAmount: combinedDiscountAmount,
            discountPercent: combinedDiscountPercent,
            notes:
              dealItems.length > 1
                ? `Deal Desk: ${dealItems.length} items clubbed. Total Rs. ${combinedStandardTotal} negotiated to Rs. ${combinedDealTotal}. Concession: Rs. ${combinedDiscountAmount} (${combinedDiscountPercent.toFixed(1)}% OFF).`
                : `Deal Desk: Rs. ${standardRate}/Kg standard negotiated to Rs. ${dealRate.toFixed(1)}/Kg. Concession: Rs. ${discountAmount} (${discountPercent.toFixed(1)}% OFF).`,
          }),
        });
        const data = await res.json();
        if (data.success && data.paymentLink?.short_url) {
          payUrl = data.paymentLink.short_url;
          plId = data.paymentLink.id;
          setActivePaymentLink(payUrl);
        }
      }

      // Auto-save Invoice to DB with status PAYMENT DUE so it shows in POS Billing WhatsApp Orders!
      const invoicePayload = {
        num: dealNum,
        name: cName,
        phone: cleanPhone,
        items: dealItems.map((item) => ({
          n: `${item.productName} (Special Agreed Price)`,
          w: item.weightKg,
          r: Math.round(item.dealRate * 100) / 100,
          t: item.dealTotal,
          standardRate: item.standardRate,
          standardTotal: item.standardTotal,
          discountAmount: item.discountAmount,
        })),
        tw: combinedWeight,
        tot: combinedDealTotal,
        standardTotal: combinedStandardTotal,
        discountAmount: combinedDiscountAmount,
        notes:
          dealItems.length > 1
            ? `Deal Desk: ${dealItems.length} items clubbed (${combinedWeight.toFixed(2)} Kg total)`
            : `Deal Desk: Rs. ${standardRate}/Kg standard negotiated to Rs. ${dealRate.toFixed(1)}/Kg`,
        paymentMethod: "Razorpay Link (WhatsApp Deal)",
        paymentStatus: "PAYMENT DUE",
        paymentId: null,
        paymentLinkId: plId || undefined,
        paymentLinkUrl: payUrl,
        ts: Date.now(),
      };

      try {
        await adminFetch("/api/invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: dealNum, data: invoicePayload }),
        });
      } catch (invErr) {
        console.warn("Could not save deal invoice to /api/invoice:", invErr);
      }

      // Also ensure this deal is registered in local session deals ledger
      const newDealItem: BargainDealItem = {
        id: dealNum,
        date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()),
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
        customerName: cName,
        customerPhone: cleanPhone || "N/A",
        productId: activeProduct.id,
        productName:
          dealItems.length > 1
            ? `${dealItems.length} Products Clubbed (${combinedWeight.toFixed(2)} Kg)`
            : activeProduct.name,
        weightKg: combinedWeight,
        standardRate: Math.round((combinedStandardTotal / (combinedWeight || 1)) * 100) / 100,
        standardTotal: combinedStandardTotal,
        dealTotal: combinedDealTotal,
        effectiveRate: Math.round(combinedEffectiveRate * 100) / 100,
        discountAmount: combinedDiscountAmount,
        discountPercent: Math.round(combinedDiscountPercent * 10) / 10,
        lossPerKg: Math.round(combinedLossPerKg * 100) / 100,
        qrEngine,
        paymentLinkId: plId || null,
        status: "PENDING",
      };
      setDealsLedger((prev) => [newDealItem, ...prev.filter((d) => d.id !== dealNum)]);

      // Clean, professional, 100% Unicode-safe message template (No broken box glyphs, no exclamation marks)
      const detailsSection =
        dealItems.length > 1
          ? `*CLUBBED DEAL BREAKDOWN (${dealItems.length} Items)*\n` +
            dealItems
              .map(
                (item, idx) =>
                  `*Item #${idx + 1}: ${item.productName}*\n- Quantity: ${item.weightKg} Kg @ Rs. ${item.dealRate}/Kg (Std: Rs. ${item.standardRate}/Kg)\n- Agreed Subtotal: *Rs. ${item.dealTotal.toLocaleString("en-IN")}* (Discount: Rs. ${item.discountAmount.toLocaleString("en-IN")})`
              )
              .join("\n\n") +
            `\n\n*COMBINED SUMMARY*\n- *Total Weight:* ${combinedWeight.toFixed(2)} Kg\n- *Standard Total:* Rs. ${combinedStandardTotal.toLocaleString("en-IN")}\n- *Agreed Deal Total:* *Rs. ${combinedDealTotal.toLocaleString("en-IN")}*\n- *Total Concession:* Rs. ${combinedDiscountAmount.toLocaleString("en-IN")} (${combinedDiscountPercent.toFixed(1)}% OFF)\n- *Combined Effective Rate:* Rs. ${combinedEffectiveRate.toFixed(1)}/Kg`
          : `*DEAL DETAILS*\n- *Product:* ${activeProduct.name}\n- *Quantity:* ${weight} Kg\n- *Standard Price:* Rs. ${standardTotal.toLocaleString("en-IN")} (Rs. ${standardRate}/Kg)\n- *Agreed Deal Price:* *Rs. ${dealTotal.toLocaleString("en-IN")}*\n- *Total Discount:* Rs. ${discountAmount.toLocaleString("en-IN")} (${discountPercent.toFixed(1)}% OFF)\n- *Effective Rate:* Rs. ${dealRate.toFixed(1)}/Kg`;

      const msg = `*URBAN TROUT AQUACULTURE*
_Fresh Himalayan Rainbow Trout · Srinagar_

Dear *${cName}*,
Here is your agreed locked deal invoice summary:

${detailsSection}

*TAP TO PAY SECURELY*
${payUrl || "Scan our J&K Bank Soundbox Counter QR upon collection"}

> *Amount Locked:* Rs. ${combinedDealTotal.toLocaleString("en-IN")} (Exact billing)
> *Instant Confirmation:* Payment verifies automatically via UPI, Google Pay, PhonePe, Paytm, or Card. No screenshot required.

*Urban Trout Farm Helpline:* +91 84910 06127
Naseem Bagh / Malabagh, Srinagar`;

      const targetUrl = cleanPhone
        ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;

      window.open(targetUrl, "_blank");
    } catch (e: any) {
      alert("Could not generate WhatsApp link: " + (e.message || e));
    } finally {
      setWaLinkLoading(false);
    }
  };

  // Push deal to main POS counter bill
  const handlePushToBillAction = () => {
    if (combinedDealTotal <= 0) return;
    onPushDealToBill({
      productId: activeProduct.id,
      productName:
        dealItems.length > 1
          ? `Multi-Item Deal (${dealItems.length} items)`
          : `${activeProduct.name} (Bargained Deal)`,
      weightKg: combinedWeight,
      dealRatePerKg: Math.round(combinedEffectiveRate * 100) / 100,
      dealTotal: combinedDealTotal,
      standardRatePerKg: Math.round((combinedStandardTotal / (combinedWeight || 1)) * 100) / 100,
      discountAmount: combinedDiscountAmount,
      customerName,
      customerPhone,
      items: dealItems.map((item) => ({
        productId: item.productId,
        productName: `${item.productName} (Bargained Deal)`,
        weightKg: item.weightKg,
        dealRatePerKg: item.dealRate,
        dealTotal: item.dealTotal,
        standardRatePerKg: item.standardRate,
        discountAmount: item.discountAmount,
      })),
    });
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ─── MAIN 2-COLUMN DEAL WORKSPACE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
        {/* ─── LEFT: MULTI-WAY BARGAIN CALCULATOR (7 Cols) ─── */}
        <div className="lg:col-span-7 space-y-3">
          {/* Card 1: Product, Rate & Harvest Weight */}
          <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xl">
            {/* Multi-Item Deal Management Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-base">layers</span>
                <span className="text-xs sm:text-sm font-bold text-white font-mono">
                  Items in Deal ({dealItems.length})
                </span>
                {dealItems.length > 1 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                    Combined: {combinedWeight.toFixed(2)} Kg · ₹{combinedDealTotal.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleAddDealItem()}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-all"
                title="Add another package or variety to this bargained deal (e.g. 3kg gutted & 2kg whole)"
              >
                <span className="text-sm leading-none font-bold">+</span>
                <span>Add Item</span>
              </button>
            </div>

            {/* Deal Items Chips List */}
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-800/60">
              {dealItems.map((item, idx) => {
                const isActive = item.id === (activeDealItem?.id || activeDealItemId);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectDealItem(item.id)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? "bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10"
                        : "bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/30 text-cyan-300 text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-bold truncate max-w-[110px] sm:max-w-[140px]">
                        {item.productName.split(" ")[0]}
                      </span>
                      <span className="text-slate-400 text-[11px] font-bold">
                        {item.weightKg}k
                      </span>
                      <span className="text-cyan-400 font-bold text-[11px]">
                        ₹{item.dealTotal.toLocaleString("en-IN")}
                      </span>
                    </div>

                    {isActive && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-400/25 text-cyan-200 font-bold uppercase font-mono">
                        Editing
                      </span>
                    )}

                    {dealItems.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDealItem(item.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 text-xs px-1 font-bold transition-colors cursor-pointer"
                        title="Remove this item from the deal"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <h2
                className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                <span className="material-symbols-outlined text-cyan-400 text-base">scale</span>
                1. Product &amp; Harvest Weight (Item #{dealItems.findIndex((i) => i.id === (activeDealItem?.id || activeDealItemId)) + 1 || 1})
              </h2>
              <span className="text-[11px] text-cyan-400 font-mono font-bold">
                Standard: ₹{standardRate}/Kg
              </span>
            </div>

            {/* Product Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {products.map((p) => {
                const isSelected = selectedProductId === p.id && !isCustomRateActive;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p.id)}
                    className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold text-xs truncate">{p.name.split(" ")[0]} Trout</div>
                    <div className="text-cyan-400 font-mono text-xs font-bold mt-0.5">
                      ₹{p.pricePerKg}/Kg
                    </div>
                  </button>
                );
              })}

              {/* Custom Standard Rate Toggle */}
              <button
                type="button"
                onClick={handleEnableCustomRate}
                className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                  isCustomRateActive
                    ? "bg-amber-500/20 border-amber-400 text-amber-200"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-bold text-xs">✏️ Custom Rate</div>
                <div className="text-amber-400 font-mono text-xs font-bold mt-0.5">
                  {isCustomRateActive ? `₹${customStandardRate || standardRate}/Kg` : "Override Rate"}
                </div>
              </button>
            </div>

            {/* If Custom Rate active */}
            {isCustomRateActive && (
              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1.5 animate-fadeIn">
                <label className="text-[10.5px] font-bold text-amber-300 block font-mono">
                  Custom Standard Product Price (₹ / Kg):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={customStandardRate}
                    onChange={(e) => handleCustomStandardRateChange(e.target.value)}
                    placeholder="e.g. 700"
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-sm text-white font-mono font-bold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleResetCustomRate}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Harvest Weight Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <label className="uppercase tracking-wider font-bold text-slate-400 font-mono">
                  Harvest Weight:
                </label>
                {activeScaleWeight && (
                  <button
                    type="button"
                    onClick={() => handleWeightChange(activeScaleWeight)}
                    className="text-cyan-400 hover:text-cyan-300 text-[10px] font-mono underline cursor-pointer"
                  >
                    📥 Pull Live Scale Weight ({activeScaleWeight} Kg)
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={weightStr}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  placeholder="e.g. 2.0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xl font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 shadow-inner"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                  KG
                </span>
              </div>

              {/* Quick Weight Adder Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 font-mono">Presets:</span>
                {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleWeightChange(w.toFixed(1))}
                    className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer ${
                      parseFloat(weightStr) === w
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400"
                        : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                  >
                    {w}k
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const cur = parseFloat(weightStr) || 0;
                    handleWeightChange((cur + 0.5).toFixed(2));
                  }}
                  className="px-2 py-0.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-400 font-mono text-[11px] font-bold border border-cyan-500/30 cursor-pointer"
                >
                  +0.5
                </button>
              </div>
            </div>

            {/* Standard Inventory Baseline Display */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">
                  {dealItems.length > 1 ? "Active Item Standard Baseline" : "Standard Inventory Bill Total"}
                </span>
                <div className="text-base sm:text-lg font-black text-white font-mono">
                  ₹{standardTotal.toLocaleString("en-IN")}
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-400 font-mono">
                <div>{weight.toFixed(2)} Kg @ ₹{standardRate}/Kg</div>
                {dealItems.length > 1 && (
                  <div className="text-cyan-400 text-[10px] font-bold">
                    Combined Std: ₹{combinedStandardTotal.toLocaleString("en-IN")} ({combinedWeight.toFixed(2)} Kg)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: What Customer Wants to Pay (Multi-Way Negotiation Input) */}
          <div className="bg-slate-900/85 border border-cyan-500/30 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h2
                className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                <span className="material-symbols-outlined text-amber-400 text-base">calculate</span>
                2. Customer Bargain / Offer Calculator
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                Instant Loss &amp; Rate Breakdown
              </span>
            </div>

            {/* 4 Interactive Input Mode Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[10px] font-mono font-bold">
              {[
                { id: "total", label: "₹ Deal Total" },
                { id: "rate", label: "₹ / Kg Rate" },
                { id: "percent", label: "% Discount" },
                { id: "flat", label: "₹ Flat Off" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveInputMode(m.id as any)}
                  className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    activeInputMode === m.id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Dynamic Input Based on Mode */}
            {activeInputMode === "total" && (
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-bold block">
                  Customer Offered Lump-Sum Amount (₹ Total for Item #{dealItems.findIndex((i) => i.id === (activeDealItem?.id || activeDealItemId)) + 1 || 1}):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 font-bold font-mono text-lg">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={dealTotalStr}
                    onChange={(e) => applyDealTotal(parseFloat(e.target.value) || 0)}
                    placeholder={`e.g. ${Math.floor(standardTotal * 0.9)}`}
                    className="w-full bg-slate-950 border-2 border-cyan-500/50 rounded-xl pl-8 pr-4 py-2 text-xl font-mono text-white font-black focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Enter what the customer is asking to pay for this item parcel.
                </p>
              </div>
            )}

            {activeInputMode === "rate" && (
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-bold block">
                  Negotiated Rate Per Kg (₹ / Kg for Item #{dealItems.findIndex((i) => i.id === (activeDealItem?.id || activeDealItemId)) + 1 || 1}):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 font-bold font-mono text-lg">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={dealRateStr}
                    onChange={(e) => applyDealRate(parseFloat(e.target.value) || 0)}
                    placeholder={`e.g. ${standardRate - 50}`}
                    className="w-full bg-slate-950 border-2 border-cyan-500/50 rounded-xl pl-8 pr-16 py-2 text-xl font-mono text-white font-black focus:outline-none focus:border-cyan-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                    / KG
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  Standard is ₹{standardRate}/Kg. Enter the discounted rate per kg.
                </p>
              </div>
            )}

            {activeInputMode === "percent" && (
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-bold block">
                  Discount Percentage (% Off for Item #{dealItems.findIndex((i) => i.id === (activeDealItem?.id || activeDealItemId)) + 1 || 1}):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={discountPercentStr}
                    onChange={(e) => applyDiscountPercent(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 10"
                    className="w-full bg-slate-950 border-2 border-cyan-500/50 rounded-xl px-4 py-2 text-xl font-mono text-white font-black focus:outline-none focus:border-cyan-400"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 font-bold font-mono text-lg">
                    %
                  </span>
                </div>
              </div>
            )}

            {activeInputMode === "flat" && (
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-bold block">
                  Flat Cash Off Discount (₹ Less for Item #{dealItems.findIndex((i) => i.id === (activeDealItem?.id || activeDealItemId)) + 1 || 1}):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 font-bold font-mono text-lg">
                    -₹
                  </span>
                  <input
                    type="number"
                    value={flatDiscountStr}
                    onChange={(e) => applyFlatDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 100"
                    className="w-full bg-slate-950 border-2 border-cyan-500/50 rounded-xl pl-10 pr-4 py-2 text-xl font-mono text-white font-black focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            )}

            {/* Quick 1-Click Bargain Presets */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <span className="text-[10.5px] font-mono text-slate-400 block">
                ⚡ Quick Concession Presets (1-Tap during negotiation):
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRoundToFifty}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs font-bold border border-slate-700 cursor-pointer"
                  title="Round total down to nearest ₹50"
                >
                  Round to ₹50
                </button>
                <button
                  type="button"
                  onClick={handleRoundToHundred}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs font-bold border border-slate-700 cursor-pointer"
                  title="Round total down to nearest ₹100"
                >
                  Round to ₹100
                </button>
                {[5, 8, 10, 12, 15].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyDiscountPercent(pct)}
                    className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-300 font-mono text-xs font-bold border border-slate-700 cursor-pointer"
                  >
                    {pct}% Off
                  </button>
                ))}
                {[50, 100, 150, 200].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => applyFlatDiscount(amt)}
                    className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-rose-300 font-mono text-xs font-bold border border-slate-700 cursor-pointer"
                  >
                    -₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Details with Autocomplete Search from Database */}
            <div className="pt-2 border-t border-slate-800/80">
              <CustomerAutocompleteInput
                customerName={customerName}
                customerPhone={customerPhone}
                onNameChange={setCustomerName}
                onPhoneChange={setCustomerPhone}
                customers={customers}
                loadingCustomers={loadingCustomers}
                theme="cyan"
                showNotesField={false}
                showEmailField={false}
              />
            </div>
          </div>
        </div>

        {/* ─── RIGHT: EXACT LOSS INSIGHTS & LOCKED-IN QR (5 Cols) ─── */}
        <div className="lg:col-span-5 space-y-3">
          {/* 1. HOW MUCH LESS AM I SELLING & HOW MUCH DO I LOSE? (LIVE BREAKDOWN) */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 font-mono">
                  {dealItems.length > 1 ? "Live Combined Concession Analysis" : "Live Concession Analysis"}
                </span>
                <h3
                  className="text-lg sm:text-xl font-black text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  Agreed Deal:{" "}
                  <span className="text-emerald-400">
                    ₹{combinedDealTotal.toLocaleString("en-IN")}
                  </span>
                </h3>
                {dealItems.length > 1 && (
                  <div className="text-[10px] font-mono text-cyan-400 font-bold">
                    {dealItems.length} Products Clubbed · {combinedWeight.toFixed(2)} Kg Total
                  </div>
                )}
              </div>
              {combinedDealTotal > 0 && (
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                    combinedDiscountAmount > 0
                      ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {combinedDiscountAmount > 0
                    ? `-${combinedDiscountPercent.toFixed(1)}% OFF`
                    : "Standard Rate"}
                </span>
              )}
            </div>

            {/* 3 Clean Crucial Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
              {/* Metric 1: Less Amount (Direct Cash Loss) */}
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-rose-500/30 space-y-0.5">
                <span className="text-[10px] text-slate-400 block">Less Amount:</span>
                <div className="text-base font-black text-rose-400">
                  {combinedDiscountAmount > 0
                    ? `-₹${combinedDiscountAmount.toLocaleString("en-IN")}`
                    : "₹0"}
                </div>
                <div className="text-[9px] text-rose-400/80">
                  {combinedDiscountAmount > 0 ? `Losing ₹${combinedDiscountAmount}` : "Full price"}
                </div>
              </div>

              {/* Metric 2: Loss Per Kilogram */}
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-rose-500/30 space-y-0.5">
                <span className="text-[10px] text-slate-400 block">Concession / Kg:</span>
                <div className="text-base font-black text-rose-400">
                  {combinedLossPerKg > 0 ? `-₹${combinedLossPerKg.toFixed(1)}/Kg` : "₹0/Kg"}
                </div>
                <div className="text-[9px] text-rose-400/80">
                  {combinedLossPerKg > 0 ? `-₹${combinedLossPerKg.toFixed(1)}/kg` : "Zero loss"}
                </div>
              </div>

              {/* Metric 3: Standard Price vs Realized */}
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 block">Effective Rate:</span>
                <div className="text-base font-black text-cyan-300">
                  ₹{combinedEffectiveRate.toFixed(1)}/Kg
                </div>
                <div className="text-[9px] text-slate-500">
                  Std: ₹{Math.round(combinedStandardTotal / (combinedWeight || 1))}/Kg
                </div>
              </div>
            </div>

            {/* Multi-Item Breakdown List in Right Card */}
            {dealItems.length > 1 && (
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  <span>Clubbed Items ({dealItems.length})</span>
                  <span>Agreed Price</span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  {dealItems.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectDealItem(item.id)}
                      className={`flex items-center justify-between p-1.5 rounded-lg border cursor-pointer transition-all ${
                        item.id === (activeDealItem?.id || activeDealItemId)
                          ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-200"
                          : "bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                        <span className="font-bold truncate text-[11px]">{item.productName.split(" ")[0]}</span>
                        <span className="text-slate-400 text-[10px]">{item.weightKg}k @ ₹{item.dealRate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">
                          ₹{item.dealTotal.toLocaleString("en-IN")}
                        </span>
                        {item.discountAmount > 0 && (
                          <span className="text-[10px] text-rose-400">(-₹{item.discountAmount})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. LOCKED-IN QR CODE GENERATION & REAL-TIME AUTO-VERIFY */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-cyan-400 text-base">lock</span>
                <h3
                  className="text-xs sm:text-sm font-bold text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  Locked-in Payment QR
                </h3>
              </div>

              {/* QR Engine Switcher (Default: J&K Soundbox) */}
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setQrEngine("soundbox")}
                  className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${
                    qrEngine === "soundbox"
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Direct J&K Soundbox locked UPI QR (Default)"
                >
                  🔊 J&amp;K Soundbox
                </button>
                <button
                  type="button"
                  onClick={() => setQrEngine("razorpay")}
                  className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${
                    qrEngine === "razorpay"
                      ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Single-use amount locked BharatQR with real-time auto capture"
                >
                  ⚡ Razorpay (Auto)
                </button>
              </div>
            </div>

            {/* QR Code Presentation Box */}
            {combinedDealTotal <= 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-1 font-mono text-xs">
                <span className="material-symbols-outlined text-3xl opacity-40">qr_code_2</span>
                <div>Enter customer bargain amount above to generate locked QR</div>
              </div>
            ) : isDealPaid ? (
              /* ─── PAID STATE CELEBRATION ─── */
              <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-950/50 to-slate-950 border border-emerald-500/50 text-center space-y-2 animate-fadeIn">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 flex items-center justify-center mx-auto text-2xl font-black shadow-lg shadow-emerald-500/20">
                  ✓
                </div>
                <div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold uppercase">
                    Locked Deal Paid &amp; Verified ✓
                  </span>
                  <h4 className="text-xl font-black text-white mt-1">
                    ₹{combinedDealTotal.toLocaleString("en-IN")} Received
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Ref: <strong className="text-emerald-300">{dealPaymentRef}</strong>
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-mono">
                  ⚡ Payment received successfully. Customer saved ₹{combinedDiscountAmount.toLocaleString("en-IN")}.
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDealPaid(false);
                      setRzpQrId(null);
                      setRzpQrImageUrl(null);
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
                  >
                    Reset for Next Deal
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchTab("pos")}
                    className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold font-mono uppercase cursor-pointer"
                  >
                    Go to Counter POS →
                  </button>
                </div>
              </div>
            ) : (
              /* ─── READY OR ACTIVE SCAN STATE ─── */
              <div className="flex flex-col items-center text-center space-y-3">
                {qrEngine === "razorpay" && !rzpQrImageUrl && (
                  <div className="w-full py-4 text-center space-y-2">
                    <p className="text-xs text-slate-400 font-mono">
                      Generate a dynamic single-use QR locked strictly to{" "}
                      <strong className="text-cyan-300 font-bold">₹{combinedDealTotal}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleGenerateLockedQr(true)}
                      disabled={rzpQrLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-black uppercase tracking-wider text-xs transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {rzpQrLoading ? (
                        <>
                          <span className="animate-spin text-sm">⏳</span>
                          <span>Creating Locked BharatQR...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">lock</span>
                          <span>Generate Locked QR (₹{combinedDealTotal.toLocaleString("en-IN")})</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Show QR code if generated or in soundbox mode */}
                {((qrEngine === "razorpay" && rzpQrImageUrl) || qrEngine === "soundbox") && (
                  <>
                    <div
                      onClick={() => setCustomerDisplayOpen(true)}
                      className="relative w-44 h-44 sm:w-48 sm:h-48 bg-white border-2 border-emerald-400/60 rounded-2xl shadow-2xl overflow-hidden cursor-pointer group flex items-center justify-center p-1.5 transition-all hover:border-emerald-300"
                      title="Click to open Fullscreen Customer Facing Display"
                    >
                      <img
                        src={qrEngine === "razorpay" ? rzpQrImageUrl! : soundboxQrUrl}
                        alt="Locked Deal QR"
                        className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-200 group-hover:scale-[1.05]"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-2.5 py-1 rounded-lg bg-black/80 text-white text-[11px] font-mono font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">open_in_full</span>
                          Customer View
                        </span>
                      </div>
                    </div>

                    {/* QR Status Bar */}
                    <div className="flex items-center justify-between w-full px-1 text-[11px] font-mono">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>
                          {qrEngine === "soundbox"
                            ? "J&K Soundbox QR Active"
                            : "Auto-detecting scan..."}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCustomerDisplayOpen(true)}
                          className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase cursor-pointer"
                        >
                          🖥️ Enlarge
                        </button>
                        {qrEngine === "soundbox" && (
                          <button
                            type="button"
                            onClick={handleConfirmSoundboxPaid}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold uppercase cursor-pointer shadow-sm"
                            title="Confirm Soundbox announcement"
                          >
                            ✓ Soundbox Paid
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Badge: Locked Notice */}
                    <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono w-full flex items-center justify-center gap-1">
                      <span>🔒</span>
                      <span>
                        Amount strictly locked to <strong>₹{combinedDealTotal}</strong>. Cannot be modified by customer.
                      </span>
                    </div>
                  </>
                )}

                {/* Deal Action Buttons */}
                <div className="grid grid-cols-2 gap-2 w-full pt-1">
                  <button
                    type="button"
                    onClick={handlePushToBillAction}
                    className="py-2 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    title="Load this discounted product and price into the Counter Bill"
                  >
                    <span className="material-symbols-outlined text-sm">shopping_cart_checkout</span>
                    <span>Push to Bill</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendWhatsAppDeal}
                    disabled={waLinkLoading}
                    className="py-2 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    title="Send locked payment link via WhatsApp"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    <span>{waLinkLoading ? "Sending..." : "WhatsApp Deal"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* ─── CUSTOMER FACING FULLSCREEN / STANDEE DISPLAY MODAL ─── */}
      {customerDisplayOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCustomerDisplayOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn"
        >
          <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500/50 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setCustomerDisplayOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>

            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider mb-2">
                <span>🐟 Urban Trout Aquaculture</span>
              </div>
              <h2
                className="text-xl sm:text-2xl font-black text-white"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                Special Locked Deal
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {dealItems.length > 1
                  ? `${dealItems.length} Products Clubbed (${combinedWeight.toFixed(2)} Kg total)`
                  : `${weight.toFixed(2)} Kg ${activeProduct.name}`}
              </p>
            </div>

            {/* Price & Savings Pill */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-1">
              <span className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">
                Agreed Payable Amount
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
                ₹{combinedDealTotal.toLocaleString("en-IN")}.00
              </div>
              {combinedDiscountAmount > 0 && (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-mono font-bold">
                  <span>
                    🏷️ You Saved ₹{combinedDiscountAmount.toLocaleString("en-IN")} ({combinedDiscountPercent.toFixed(1)}% OFF)
                  </span>
                </div>
              )}
            </div>

            {/* Multi-item breakdown list in modal if > 1 item */}
            {dealItems.length > 1 && (
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-left space-y-1 font-mono text-xs">
                {dealItems.map((item, idx) => (
                  <div key={item.id} className="flex justify-between text-slate-300">
                    <span>
                      #{idx + 1} {item.productName.split(" ")[0]} ({item.weightKg}k @ ₹{item.dealRate})
                    </span>
                    <span className="font-bold text-white">
                      ₹{item.dealTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* High-Resolution QR Display */}
            <div className="w-56 h-56 mx-auto bg-white p-2 rounded-2xl shadow-xl flex items-center justify-center border-4 border-emerald-400">
              <img
                src={qrEngine === "razorpay" && rzpQrImageUrl ? rzpQrImageUrl : soundboxQrUrl}
                alt="Locked Payment QR"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Scannable Notice */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-emerald-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Amount locked to ₹{combinedDealTotal} • Scan to Pay</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Supported: Google Pay • PhonePe • Paytm • BHIM • Cred • Any UPI App
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCustomerDisplayOpen(false)}
                className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold cursor-pointer"
              >
                Close Customer View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
