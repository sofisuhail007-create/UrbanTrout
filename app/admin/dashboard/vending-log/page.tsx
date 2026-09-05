"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/adminClient";
import { CustomColumnDef, VendingSalesEntry } from "@/app/api/vending-log/route";

const DEFAULT_GUTTED_PRICE = 580;
const DEFAULT_NON_GUTTED_PRICE = 540;

// Exact weight formatter helper - preserves 3 decimal precision (e.g. 2.155 stays 2.155)
export const formatKg = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === "") return "0.000";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num.toFixed(3);
};

const VENDING_SQL_QUERY = `-- URBAN TROUT VENDING CENTER SALES DATA LOGGER TABLE
CREATE TABLE IF NOT EXISTS public.vending_sales_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_time TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'),
    weight_kg NUMERIC(10, 3) NOT NULL,
    product_type TEXT NOT NULL DEFAULT 'Gutted',
    rate_per_kg NUMERIC(10, 2) NOT NULL DEFAULT 580.00,
    expected_amount NUMERIC(10, 2),
    amount_paid NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    payment_mode TEXT NOT NULL DEFAULT 'Cash',
    custom_fields JSONB DEFAULT '{}'::jsonb,
    logged_by TEXT DEFAULT 'Counter Staff',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vending_sales_date ON public.vending_sales_log(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_vending_sales_created ON public.vending_sales_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vending_sales_type ON public.vending_sales_log(product_type);
CREATE INDEX IF NOT EXISTS idx_vending_sales_payment ON public.vending_sales_log(payment_mode);

ALTER TABLE public.vending_sales_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to vending_sales_log" ON public.vending_sales_log FOR SELECT USING (true);
CREATE POLICY "Allow full access to vending_sales_log" ON public.vending_sales_log FOR ALL USING (true) WITH CHECK (true);`;

export default function VendingCenterLoggerPage() {
  // ─── State ───
  const [entries, setEntries] = useState<VendingSalesEntry[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumnDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTableAvailable, setIsTableAvailable] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Period filter: today | week | month | all | custom
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all" | "custom">("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Search & Type/Payment filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");

  // Modals
  const [newEntryModalOpen, setNewEntryModalOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VendingSalesEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Entry Form State
  const now = new Date();
  const getTodayDate = () => new Date().toISOString().split("T")[0];
  const getCurrentTime = () =>
    new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const [formDate, setFormDate] = useState(getTodayDate());
  const [formTime, setFormTime] = useState(getCurrentTime());
  const [formType, setFormType] = useState<"Gutted" | "Non Gutted" | string>("Gutted");
  const [formWeight, setFormWeight] = useState<string>("");
  const [formRate, setFormRate] = useState<number>(DEFAULT_GUTTED_PRICE);
  const [formAmount, setFormAmount] = useState<string>("");
  const [formAmountOverridden, setFormAmountOverridden] = useState(false);
  const [formPayment, setFormPayment] = useState<string>("Cash");
  const [formCustomFields, setFormCustomFields] = useState<Record<string, any>>({});
  const [formNotes, setFormNotes] = useState("");
  const [formLoggedBy, setFormLoggedBy] = useState("Counter Staff");

  // Dynamic Pricing from Supabase Inventory table
  const [guttedPrice, setGuttedPrice] = useState<number>(DEFAULT_GUTTED_PRICE);
  const [nonGuttedPrice, setNonGuttedPrice] = useState<number>(DEFAULT_NON_GUTTED_PRICE);
  const [pricingLoaded, setPricingLoaded] = useState(false);

  // New Column Form State
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<"text" | "number" | "select">("text");
  const [newColOptions, setNewColOptions] = useState("");

  // Success chime
  const playLogChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(880, now); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (_) {}
  };

  // Fetch live trout prices from inventory
  useEffect(() => {
    async function loadInventoryPricing() {
      try {
        const res = await adminFetch("/api/inventory");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.inventory)) {
            const guttedItem = data.inventory.find(
              (i: any) =>
                i.product_id === "gutted-trout" ||
                (i.name && i.name.toLowerCase().includes("gutted") && !i.name.toLowerCase().includes("non"))
            );
            const wholeItem = data.inventory.find(
              (i: any) =>
                i.product_id === "whole-trout" ||
                (i.name &&
                  (i.name.toLowerCase().includes("whole") ||
                    i.name.toLowerCase().includes("non-gutted") ||
                    i.name.toLowerCase().includes("non gutted")))
            );

            const gPrice = guttedItem?.price_per_kg ? Number(guttedItem.price_per_kg) : DEFAULT_GUTTED_PRICE;
            const ngPrice = wholeItem?.price_per_kg ? Number(wholeItem.price_per_kg) : DEFAULT_NON_GUTTED_PRICE;

            setGuttedPrice(gPrice);
            setNonGuttedPrice(ngPrice);
            setPricingLoaded(true);

            setFormRate((currentRate) => {
              if (currentRate === DEFAULT_GUTTED_PRICE || currentRate === 650 || currentRate === 580) {
                return gPrice;
              }
              return currentRate;
            });
          }
        }
      } catch (err) {
        console.warn("Could not fetch inventory pricing:", err);
      }
    }
    loadInventoryPricing();
  }, []);

  // ─── Auto calculate Amount when Weight or Rate changes ───
  useEffect(() => {
    const w = parseFloat(formWeight);
    if (!isNaN(w) && w > 0 && !formAmountOverridden) {
      setFormAmount(Math.round(w * formRate).toString());
    } else if (!formAmountOverridden && !formWeight) {
      setFormAmount("");
    }
  }, [formWeight, formRate, formAmountOverridden]);

  // Handle Type Change
  const handleTypeSelect = (type: "Gutted" | "Non Gutted") => {
    setFormType(type);
    const rate = type === "Gutted" ? guttedPrice : nonGuttedPrice;
    setFormRate(rate);
    const w = parseFloat(formWeight);
    if (!isNaN(w) && w > 0 && !formAmountOverridden) {
      setFormAmount(Math.round(w * rate).toString());
    }
  };

  // ─── Fetch Data ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Try local cache first
      try {
        const cached = localStorage.getItem("ut_vending_sales_log_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEntries(parsed);
          }
        }
      } catch (_) {}

      // 2. Fetch from API
      let url = "/api/vending-log";
      const params = new URLSearchParams();
      if (period === "custom" && customStartDate && customEndDate) {
        params.set("startDate", customStartDate);
        params.set("endDate", customEndDate);
      }
      if (params.toString()) url += `?${params.toString()}`;

      const res = await adminFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEntries(data.entries || []);
          setCustomColumns(data.customColumns || []);
          setIsTableAvailable(data.isTableAvailable ?? true);
          try {
            localStorage.setItem("ut_vending_sales_log_cache", JSON.stringify(data.entries || []));
            localStorage.setItem("ut_vending_custom_cols_cache", JSON.stringify(data.customColumns || []));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error("Failed to load vending log:", err);
    } finally {
      setLoading(false);
    }
  }, [period, customStartDate, customEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Read stored staff email for formLoggedBy
  useEffect(() => {
    try {
      const email = localStorage.getItem("ut_admin_email");
      if (email) setFormLoggedBy(email.split("@")[0]);
    } catch (_) {}
  }, []);

  // ─── Period Calculations ───
  const filteredEntriesByPeriod = useMemo(() => {
    const todayStr = getTodayDate();
    const currDate = new Date();

    // Monday of current week
    const day = currDate.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(currDate);
    monday.setDate(currDate.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    // 1st of current month
    const firstOfMonth = new Date(currDate.getFullYear(), currDate.getMonth(), 1);

    return entries.filter((e) => {
      const eDate = new Date(e.entry_date);
      if (period === "today") return e.entry_date === todayStr;
      if (period === "week") return eDate >= monday;
      if (period === "month") return eDate >= firstOfMonth;
      if (period === "custom") {
        if (customStartDate && e.entry_date < customStartDate) return false;
        if (customEndDate && e.entry_date > customEndDate) return false;
        return true;
      }
      return true; // "all"
    });
  }, [entries, period, customStartDate, customEndDate]);

  // ─── KPI Metrics (Computed on period filtered entries) ───
  const kpis = useMemo(() => {
    let totalKg = 0;
    let totalRevenue = 0;
    let totalExpected = 0;
    let totalLoss = 0;
    let guttedKg = 0;
    let nonGuttedKg = 0;
    let onlineRevenue = 0;
    let onlineCount = 0;
    let onlineKg = 0;
    let cashRevenue = 0;
    let cashCount = 0;
    let cashKg = 0;
    const byMode: Record<string, { count: number; revenue: number; kg: number }> = {};

    filteredEntriesByPeriod.forEach((e) => {
      const w = Number(e.weight_kg) || 0;
      const rev = Number(e.amount_paid) || 0;
      const rate = Number(e.rate_per_kg) || 0;
      const exp =
        e.expected_amount !== undefined && e.expected_amount !== null
          ? Number(e.expected_amount)
          : Math.round(w * rate);
      const loss =
        e.discount_amount !== undefined && e.discount_amount !== null
          ? Number(e.discount_amount)
          : Math.max(0, exp - rev);

      totalKg = Math.round((totalKg + w) * 1000) / 1000;
      totalRevenue += rev;
      totalExpected += exp;
      totalLoss += loss;

      const isGutted =
        (e.product_type || "").toLowerCase().includes("gutted") &&
        !(e.product_type || "").toLowerCase().includes("non");
      if (isGutted) {
        guttedKg = Math.round((guttedKg + w) * 1000) / 1000;
      } else {
        nonGuttedKg = Math.round((nonGuttedKg + w) * 1000) / 1000;
      }

      const isCash = (e.payment_mode || "").toLowerCase().trim() === "cash";
      if (isCash) {
        cashRevenue += rev;
        cashCount += 1;
        cashKg = Math.round((cashKg + w) * 1000) / 1000;
      } else {
        onlineRevenue += rev;
        onlineCount += 1;
        onlineKg = Math.round((onlineKg + w) * 1000) / 1000;
      }

      const mode = e.payment_mode || "Other";
      if (!byMode[mode]) byMode[mode] = { count: 0, revenue: 0, kg: 0 };
      byMode[mode].count += 1;
      byMode[mode].revenue += rev;
      byMode[mode].kg = Math.round((byMode[mode].kg + w) * 1000) / 1000;
    });

    const count = filteredEntriesByPeriod.length;
    const avgKgPerBill = count > 0 ? (totalKg / count).toFixed(3) : "0.000";
    const avgBillValue = count > 0 ? Math.round(totalRevenue / count) : 0;
    const lossPercent =
      totalExpected > 0 ? ((totalLoss / totalExpected) * 100).toFixed(1) : "0.0";

    return {
      totalKg,
      totalRevenue,
      totalExpected,
      totalLoss,
      lossPercent,
      guttedKg,
      nonGuttedKg,
      count,
      avgKgPerBill,
      avgBillValue,
      onlineRevenue,
      onlineCount,
      onlineKg,
      cashRevenue,
      cashCount,
      cashKg,
      byMode,
    };
  }, [filteredEntriesByPeriod]);

  // ─── Search & Dropdown Filtered Table List ───
  const displayEntries = useMemo(() => {
    return filteredEntriesByPeriod.filter((e) => {
      // Type filter
      if (filterType !== "all") {
        if (filterType === "gutted" && !e.product_type?.toLowerCase().includes("gutted")) return false;
        if (filterType === "non-gutted" && !e.product_type?.toLowerCase().includes("non")) return false;
      }

      // Payment filter
      if (filterPayment !== "all") {
        const isCash = (e.payment_mode || "").toLowerCase().trim() === "cash";
        if (filterPayment === "Cash" && !isCash) return false;
        if (filterPayment === "Online Payment" && isCash) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inDate = e.entry_date.includes(q);
        const inTime = e.entry_time.toLowerCase().includes(q);
        const inType = e.product_type.toLowerCase().includes(q);
        const inMode = e.payment_mode.toLowerCase().includes(q);
        const inNotes = (e.notes || "").toLowerCase().includes(q);
        const inLogged = (e.logged_by || "").toLowerCase().includes(q);
        const inCustom = Object.values(e.custom_fields || {}).some((v) =>
          String(v).toLowerCase().includes(q)
        );
        return inDate || inTime || inType || inMode || inNotes || inLogged || inCustom;
      }

      return true;
    });
  }, [filteredEntriesByPeriod, filterType, filterPayment, searchQuery]);

  // ─── Reset Form ───
  const resetForm = () => {
    setFormDate(getTodayDate());
    setFormTime(getCurrentTime());
    setFormType("Gutted");
    setFormWeight("");
    setFormRate(guttedPrice);
    setFormAmount("");
    setFormAmountOverridden(false);
    setFormPayment("Cash");
    setFormCustomFields({});
    setFormNotes("");
    setEditingEntry(null);
  };

  // ─── Handle Save Entry ───
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(formWeight);
    const amt = parseFloat(formAmount);

    if (isNaN(w) || w <= 0) {
      alert("Please enter a valid weight in Kg.");
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid Amount Paid.");
      return;
    }

    const calculatedExpected = Math.round(w * formRate);
    const expected = calculatedExpected;
    const discount = Math.max(0, expected - amt);

    setSaving(true);
    try {
      if (editingEntry) {
        // Edit entry
        const updates = {
          entry_date: formDate,
          entry_time: formTime,
          product_type: formType,
          weight_kg: w,
          rate_per_kg: formRate,
          expected_amount: expected,
          amount_paid: amt,
          discount_amount: discount,
          payment_mode: formPayment,
          custom_fields: formCustomFields,
          notes: formNotes,
          logged_by: formLoggedBy,
        };

        const res = await adminFetch("/api/vending-log", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingEntry.id, updates }),
        });

        if (res.ok) {
          setEntries((prev) =>
            prev.map((item) =>
              item.id === editingEntry.id ? { ...item, ...updates } : item
            )
          );
          setNewEntryModalOpen(false);
          resetForm();
          playLogChime();
        }
      } else {
        // Create new entry
        const payload = {
          entry_date: formDate,
          entry_time: formTime,
          product_type: formType,
          weight_kg: w,
          rate_per_kg: formRate,
          expected_amount: expected,
          amount_paid: amt,
          discount_amount: discount,
          payment_mode: formPayment,
          custom_fields: formCustomFields,
          notes: formNotes,
          logged_by: formLoggedBy,
        };

        const res = await adminFetch("/api/vending-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.entry) {
            setEntries((prev) => [json.entry, ...prev]);
            setNewEntryModalOpen(false);
            resetForm();
            playLogChime();
          }
        }
      }
    } catch (err) {
      console.error("Error saving sales log entry:", err);
      alert("Failed to save entry. Please check connection.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Handle Delete Entry ───
  const handleDeleteEntry = async (id: string) => {
    try {
      const res = await adminFetch(`/api/vending-log?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  // ─── Custom Column Handlers ───
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    const colId = newColName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (customColumns.some((c) => c.id === colId)) {
      alert("A column with a similar name already exists.");
      return;
    }

    const options =
      newColType === "select"
        ? newColOptions
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const newCol: CustomColumnDef = {
      id: colId,
      name: newColName.trim(),
      type: newColType,
      options,
      visible: true,
    };

    const updatedCols = [...customColumns, newCol];
    setCustomColumns(updatedCols);
    setNewColName("");
    setNewColOptions("");

    await adminFetch("/api/vending-log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customColumns: updatedCols }),
    });
  };

  const handleToggleColVisibility = async (colId: string) => {
    const updated = customColumns.map((c) => (c.id === colId ? { ...c, visible: !c.visible } : c));
    setCustomColumns(updated);
    await adminFetch("/api/vending-log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customColumns: updated }),
    });
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!confirm("Are you sure you want to remove this column? Past values won't be deleted.")) return;
    const updated = customColumns.filter((c) => c.id !== colId);
    setCustomColumns(updated);
    await adminFetch("/api/vending-log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customColumns: updated }),
    });
  };

  // ─── Export to CSV ───
  const handleExportCSV = () => {
    if (displayEntries.length === 0) {
      alert("No entries to export in the current view.");
      return;
    }

    const activeCustomCols = customColumns.filter((c) => c.visible);

    // Headers
    const headers = [
      "Date",
      "Time",
      "Product Type",
      "Weight (Kg)",
      "Rate (Rs/Kg)",
      "Expected Amount (Rs)",
      "Amount Taken (Rs)",
      "Negotiation Loss (Rs)",
      "Payment Mode",
      ...activeCustomCols.map((c) => c.name),
      "Notes",
      "Logged By",
    ];

    const rows = displayEntries.map((e) => {
      const exp =
        e.expected_amount !== undefined && e.expected_amount !== null
          ? Number(e.expected_amount)
          : Math.round(Number(e.weight_kg) * Number(e.rate_per_kg));
      const taken = Number(e.amount_paid) || 0;
      const loss =
        e.discount_amount !== undefined && e.discount_amount !== null
          ? Number(e.discount_amount)
          : Math.max(0, exp - taken);

      return [
        `"${e.entry_date}"`,
        `"${e.entry_time}"`,
        `"${e.product_type}"`,
        formatKg(e.weight_kg),
        e.rate_per_kg,
        exp,
        taken,
        loss,
        `"${e.payment_mode}"`,
        ...activeCustomCols.map((c) => `"${e.custom_fields?.[c.id] ?? ""}"`),
        `"${(e.notes || "").replace(/"/g, '""')}"`,
        `"${e.logged_by || ""}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Urban_Trout_Vending_Sales_${period}_${getTodayDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(VENDING_SQL_QUERY);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Open Edit modal
  const openEditModal = (entry: VendingSalesEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.entry_date);
    setFormTime(entry.entry_time);
    setFormType(entry.product_type);
    setFormWeight(entry.weight_kg.toString());
    setFormRate(entry.rate_per_kg);
    setFormAmount(entry.amount_paid.toString());
    setFormAmountOverridden(true);
    const isCash = (entry.payment_mode || "").toLowerCase().trim() === "cash";
    setFormPayment(isCash ? "Cash" : "Online Payment");
    setFormCustomFields(entry.custom_fields || {});
    setFormNotes(entry.notes || "");
    setFormLoggedBy(entry.logged_by || "Counter Staff");
    setNewEntryModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ══════════════════════════════════════════════════════════
          TOP HEADER & ACTIONS
          ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 font-mono">
              Vending Center Sales
            </span>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            Daily Sales &amp; Weight Data Logger
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Log, track, and audit counter trout dispatches, live Kg sold, and revenue collection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/dashboard/billing"
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
            title="Switch to live POS Billing & Invoice generator"
          >
            <span className="material-symbols-outlined text-sm">point_of_sale</span>
            POS Billing
          </Link>

          <button
            type="button"
            onClick={() => setColumnManagerOpen(true)}
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Add or remove dynamic custom columns"
          >
            <span className="material-symbols-outlined text-sm">view_column</span>
            Columns ({customColumns.filter((c) => c.visible).length})
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export filtered records to CSV"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setNewEntryModalOpen(true);
            }}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Log Sale
          </button>
        </div>
      </div>

      {/* Notice if table is ready or in fallback mode */}
      {!isTableAvailable && !bannerDismissed && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-400">info</span>
            <span>
              <strong>Active in Safe-Cache Mode:</strong> Your sales are being saved safely! To unlock dedicated PostgreSQL tables in Supabase, run <code className="text-amber-200 bg-amber-950/60 px-1 py-0.5 rounded">supabase_vending_logger.sql</code> in your Supabase SQL Editor.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleCopySql}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">content_copy</span>
              {copiedSql ? "✓ Copied!" : "Copy SQL"}
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-400/80 hover:text-amber-200 transition-all cursor-pointer"
              title="Dismiss Notice"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PERIOD SWITCHER & LIVE SUMMARY RIBBON
          ══════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        {/* Period Selector Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {[
              { id: "today", label: "Today" },
              { id: "week", label: "This Week" },
              { id: "month", label: "This Month" },
              { id: "all", label: "All Time" },
              { id: "custom", label: "Custom Range" },
            ].map((tab) => {
              const isSel = period === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id as any)}
                  className={`py-1.5 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                    isSel
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {period === "custom" && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-emerald-400"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
          )}
        </div>

        {/* 5-Stat Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Weight Sold */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900 border border-emerald-500/30 shadow-xl shadow-emerald-950/20 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                <span>TOTAL KG SOLD</span>
                <span className="material-symbols-outlined text-emerald-400 text-lg">scale</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className="text-3xl sm:text-4xl font-black text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {formatKg(kpis.totalKg)}
                </span>
                <span className="text-emerald-400 font-bold font-mono text-sm">Kg</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-emerald-300 font-bold">Gutted: {formatKg(kpis.guttedKg)} Kg</span>
                <span className="text-cyan-300">Non: {formatKg(kpis.nonGuttedKg)} Kg</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate">{kpis.count} total dispatches logged</div>
            </div>
          </div>

          {/* Card 2: Total Revenue Collected */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-slate-900 border border-cyan-500/30 shadow-xl shadow-cyan-950/20 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                <span>REVENUE COLLECTED</span>
                <span className="material-symbols-outlined text-cyan-400 text-lg">payments</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-cyan-400 font-bold text-xl">₹</span>
                <span
                  className="text-3xl sm:text-4xl font-black text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {kpis.totalRevenue.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
              <div className="flex items-center justify-between">
                <span>Expected: ₹{kpis.totalExpected.toLocaleString("en-IN")}</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {kpis.count} bills • Avg ₹{kpis.avgBillValue}/bill
              </div>
            </div>
          </div>

          {/* Card 3: Online Payments */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900 border border-indigo-500/30 shadow-xl shadow-indigo-950/20 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                <span>ONLINE PAYMENTS</span>
                <span className="material-symbols-outlined text-indigo-400 text-lg">contactless</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-indigo-400 font-bold text-xl">₹</span>
                <span
                  className="text-3xl sm:text-4xl font-black text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {kpis.onlineRevenue.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
              <div className="flex items-center justify-between text-indigo-300">
                <span>{kpis.onlineCount} orders</span>
                <span>{formatKg(kpis.onlineKg)} Kg</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate">J&amp;K Soundbox, UPI &amp; Cards</div>
            </div>
          </div>

          {/* Card 4: Cash Payments */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-950/40 via-slate-900/80 to-slate-900 border border-teal-500/30 shadow-xl shadow-teal-950/20 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                <span>CASH PAYMENTS</span>
                <span className="material-symbols-outlined text-teal-400 text-lg">point_of_sale</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-teal-400 font-bold text-xl">₹</span>
                <span
                  className="text-3xl sm:text-4xl font-black text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {kpis.cashRevenue.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
              <div className="flex items-center justify-between text-teal-300">
                <span>{kpis.cashCount} sales</span>
                <span>{formatKg(kpis.cashKg)} Kg</span>
              </div>
              <div className="text-[10px] text-slate-500 truncate">Counter Cash Drawer</div>
            </div>
          </div>

          {/* Card 5: Negotiation Concession / Loss */}
          <div
            className={`p-4 rounded-2xl border shadow-xl relative overflow-hidden flex flex-col justify-between ${
              kpis.totalLoss > 0
                ? "bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-slate-900 border-amber-500/40 shadow-amber-950/20"
                : "bg-gradient-to-br from-emerald-950/30 via-slate-900/80 to-slate-900 border-emerald-500/30 shadow-emerald-950/10"
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                <span className={kpis.totalLoss > 0 ? "text-amber-300 font-bold" : ""}>
                  NEGOTIATION LOSS
                </span>
                <span
                  className={`material-symbols-outlined text-lg ${
                    kpis.totalLoss > 0 ? "text-amber-400 animate-pulse" : "text-emerald-400"
                  }`}
                >
                  {kpis.totalLoss > 0 ? "price_change" : "verified"}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                {kpis.totalLoss > 0 ? (
                  <>
                    <span className="text-amber-400 font-bold text-xl">-₹</span>
                    <span
                      className="text-3xl sm:text-4xl font-black text-amber-300"
                      style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    >
                      {kpis.totalLoss.toLocaleString("en-IN")}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-emerald-400 font-bold text-xl">₹</span>
                    <span
                      className="text-3xl sm:text-4xl font-black text-emerald-400"
                      style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    >
                      0
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold ml-1">
                      Full Price ✓
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
              <div className="flex items-center justify-between">
                {kpis.totalLoss > 0 ? (
                  <span className="text-amber-300 font-bold">
                    ⚠️ {kpis.lossPercent}% Conceded
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold">Zero discount loss</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {kpis.totalLoss > 0
                  ? "Lost to customer negotiation"
                  : "All orders at full inventory price"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TABLE FILTERS & CONTROLS
          ══════════════════════════════════════════════════════════ */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Search date, time, customer, notes, payment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
          />
        </div>

        {/* Filter by Type */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="gutted">Gutted</option>
            <option value="non-gutted">Non Gutted</option>
          </select>
        </div>

        {/* Filter by Payment */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Payment:</span>
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
          >
            <option value="all">All Payments</option>
            <option value="Cash">💵 Cash</option>
            <option value="Online Payment">⚡ Online Payment</option>
          </select>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          title="Refresh Data"
        >
          <span className="material-symbols-outlined text-sm">sync</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════
          DATA TABLE
          ══════════════════════════════════════════════════════════ */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-3 text-center w-10">#</th>
                <th className="py-3.5 px-3">Date</th>
                <th className="py-3.5 px-3">Time</th>
                <th className="py-3.5 px-3">Type</th>
                <th className="py-3.5 px-3 text-right">Weight (Kg)</th>
                <th className="py-3.5 px-3 text-right">Rate @/Kg</th>
                <th className="py-3.5 px-3 text-right">Expected (₹)</th>
                <th className="py-3.5 px-3 text-right text-cyan-300">Amount Taken (₹)</th>
                <th className="py-3.5 px-3 text-right text-amber-300">Negotiation Loss</th>
                <th className="py-3.5 px-3">Payment Mode</th>
                {/* Dynamic Custom Columns */}
                {customColumns
                  .filter((c) => c.visible)
                  .map((c) => (
                    <th key={c.id} className="py-3.5 px-3 text-cyan-300">
                      {c.name}
                    </th>
                  ))}
                <th className="py-3.5 px-3">Notes</th>
                <th className="py-3.5 px-3">Staff</th>
                <th className="py-3.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td
                    colSpan={13 + customColumns.filter((c) => c.visible).length}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                    Loading entries…
                  </td>
                </tr>
              ) : displayEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={13 + customColumns.filter((c) => c.visible).length}
                    className="py-12 text-center text-slate-400 space-y-2"
                  >
                    <span className="material-symbols-outlined text-4xl text-slate-600">table_rows</span>
                    <p className="font-bold text-sm text-white">No sales entries found</p>
                    <p className="text-xs text-slate-500">
                      Click &quot;Log Sale&quot; to record today&apos;s first counter dispatch.
                    </p>
                  </td>
                </tr>
              ) : (
                displayEntries.map((e, index) => {
                  const isGutted =
                    (e.product_type || "").toLowerCase().includes("gutted") &&
                    !(e.product_type || "").toLowerCase().includes("non");
                  const w = Number(e.weight_kg) || 0;
                  const rate = Number(e.rate_per_kg) || 0;
                  const exp =
                    e.expected_amount !== undefined && e.expected_amount !== null
                      ? Number(e.expected_amount)
                      : Math.round(w * rate);
                  const taken = Number(e.amount_paid) || 0;
                  const loss =
                    e.discount_amount !== undefined && e.discount_amount !== null
                      ? Number(e.discount_amount)
                      : Math.max(0, exp - taken);
                  const isCash = (e.payment_mode || "").toLowerCase().trim() === "cash";

                  return (
                    <tr
                      key={e.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3 px-3 text-center text-slate-500 text-[10px]">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 text-slate-200 font-bold whitespace-nowrap">
                        {e.entry_date}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {e.entry_time}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isGutted
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          }`}
                        >
                          {e.product_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-white whitespace-nowrap font-mono">
                        <span className="text-emerald-400">{formatKg(e.weight_kg)}</span>{" "}
                        <span className="text-[10px] text-slate-400 font-normal">Kg</span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300 whitespace-nowrap font-mono">
                        ₹{e.rate_per_kg}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 whitespace-nowrap font-mono">
                        ₹{exp.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-white whitespace-nowrap font-mono">
                        <span className="text-cyan-300">₹{taken.toLocaleString("en-IN")}</span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono">
                        {loss > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            title={`Customer price negotiation concession: ₹${loss}`}
                          >
                            <span>-₹{loss.toLocaleString("en-IN")}</span>
                            <span className="text-[9px] opacity-75">loss</span>
                          </span>
                        ) : loss < 0 ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20"
                            title={`Extra collected: ₹${Math.abs(loss)}`}
                          >
                            +₹{Math.abs(loss)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                            ₹0 ✓
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isCash ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 font-mono text-[11px] font-bold">
                            💵 Cash
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-[11px] font-bold">
                            ⚡ Online Payment
                          </span>
                        )}
                      </td>

                      {/* Custom Dynamic Columns Values */}
                      {customColumns
                        .filter((c) => c.visible)
                        .map((c) => (
                          <td key={c.id} className="py-3 px-3 text-slate-300 whitespace-nowrap">
                            {e.custom_fields?.[c.id] || "—"}
                          </td>
                        ))}

                      <td className="py-3 px-3 text-slate-400 text-[11px] max-w-[150px] truncate" title={e.notes}>
                        {e.notes || "—"}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {e.logged_by || "Staff"}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => openEditModal(e)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Edit entry"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          {deleteConfirmId === e.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(e.id)}
                                className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-[9px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(e.id)}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                              title="Delete entry"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Summary Footer */}
            {displayEntries.length > 0 && (
              <tfoot>
                {(() => {
                  const totalVisKg = displayEntries.reduce(
                    (s, e) => s + (Number(e.weight_kg) || 0),
                    0
                  );
                  const totalVisExp = displayEntries.reduce((s, e) => {
                    const w = Number(e.weight_kg) || 0;
                    const r = Number(e.rate_per_kg) || 0;
                    return (
                      s +
                      (e.expected_amount !== undefined && e.expected_amount !== null
                        ? Number(e.expected_amount)
                        : Math.round(w * r))
                    );
                  }, 0);
                  const totalVisTaken = displayEntries.reduce(
                    (s, e) => s + (Number(e.amount_paid) || 0),
                    0
                  );
                  const totalVisLoss = displayEntries.reduce((s, e) => {
                    const w = Number(e.weight_kg) || 0;
                    const r = Number(e.rate_per_kg) || 0;
                    const exp =
                      e.expected_amount !== undefined && e.expected_amount !== null
                        ? Number(e.expected_amount)
                        : Math.round(w * r);
                    const paid = Number(e.amount_paid) || 0;
                    return (
                      s +
                      (e.discount_amount !== undefined && e.discount_amount !== null
                        ? Number(e.discount_amount)
                        : Math.max(0, exp - paid))
                    );
                  }, 0);

                  return (
                    <tr className="border-t-2 border-slate-700 bg-slate-950 font-mono font-bold text-xs text-white">
                      <td
                        colSpan={4}
                        className="py-3.5 px-3 text-right uppercase tracking-wider text-slate-400"
                      >
                        Visible Rows Total ({displayEntries.length} entries):
                      </td>
                      <td className="py-3.5 px-3 text-right text-emerald-400 font-black whitespace-nowrap">
                        {formatKg(totalVisKg)} Kg
                      </td>
                      <td className="py-3.5 px-3"></td>
                      <td className="py-3.5 px-3 text-right text-slate-400 whitespace-nowrap">
                        ₹{totalVisExp.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-3 text-right text-cyan-300 font-black whitespace-nowrap">
                        ₹{totalVisTaken.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {totalVisLoss > 0 ? (
                          <span className="text-amber-300 font-black">
                            -₹{totalVisLoss.toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold">₹0 ✓</span>
                        )}
                      </td>
                      <td colSpan={3 + customColumns.filter((c) => c.visible).length}></td>
                    </tr>
                  );
                })()}
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL 1: NEW / EDIT SALES LOG ENTRY
          ══════════════════════════════════════════════════════════ */}
      {newEntryModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setNewEntryModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 sm:p-7 max-w-lg w-full text-slate-200 shadow-2xl space-y-4 my-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 font-mono">
                  {editingEntry ? "Edit Sale Record" : "Log New Counter Sale"}
                </span>
                <h3
                  className="text-lg sm:text-xl font-black text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  Urban Trout Vending Entry
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNewEntryModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitEntry} className="space-y-4">
              {/* Row 1: Date & Time */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                      Time
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormTime(getCurrentTime())}
                      className="text-[9px] text-emerald-400 hover:underline cursor-pointer"
                    >
                      Now
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    placeholder="e.g. 11:30 AM"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Row 2: Product Type Quick Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                    Type of Trout <span className="text-emerald-400">*</span>
                  </label>
                  {pricingLoaded && (
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      ✓ Supabase Inventory Rate
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeSelect("Gutted")}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer text-center ${
                      formType === "Gutted"
                        ? "bg-emerald-500/20 text-emerald-300 border-2 border-emerald-500 shadow-md shadow-emerald-950/40"
                        : "bg-slate-950/80 text-slate-400 border border-slate-700 hover:text-white"
                    }`}
                  >
                    🐟 Gutted Trout
                    <span className="block text-[10px] font-mono opacity-90 mt-0.5 font-bold text-emerald-400">
                      ₹{guttedPrice} / Kg
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeSelect("Non Gutted")}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer text-center ${
                      formType === "Non Gutted"
                        ? "bg-cyan-500/20 text-cyan-300 border-2 border-cyan-500 shadow-md shadow-cyan-950/40"
                        : "bg-slate-950/80 text-slate-400 border border-slate-700 hover:text-white"
                    }`}
                  >
                    ✨ Non Gutted (Whole)
                    <span className="block text-[10px] font-mono opacity-90 mt-0.5 font-bold text-cyan-300">
                      ₹{nonGuttedPrice} / Kg
                    </span>
                  </button>
                </div>
              </div>

              {/* Row 3: Weight (Exact Precision Scale Input) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                    Exact Weight (Kg) <span className="text-emerald-400">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    Zero Rounding (e.g. 2.155 stays 2.155)
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={formWeight}
                    onChange={(e) => {
                      setFormWeight(e.target.value);
                      setFormAmountOverridden(false);
                    }}
                    required
                    placeholder="e.g. 2.155"
                    className="w-full bg-slate-950 border-2 border-emerald-500/50 rounded-xl px-4 py-3 text-lg font-black text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                  <span className="absolute right-4 top-3 text-sm text-emerald-400 font-bold font-mono">
                    Kg
                  </span>
                </div>

                {/* Quick Add Buttons */}
                <div className="grid grid-cols-5 gap-1.5 mt-2">
                  {[0.5, 1.0, 1.5, 2.0, 3.0].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(formWeight) || 0;
                        setFormWeight((cur + inc).toFixed(3));
                        setFormAmountOverridden(false);
                      }}
                      className="py-1 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold transition-all cursor-pointer text-center border border-slate-700"
                    >
                      +{inc} Kg
                    </button>
                  ))}
                </div>
              </div>

              {/* Expected vs Actual Price & Negotiation Loss Section */}
              {(() => {
                const wNum = parseFloat(formWeight) || 0;
                const expectedTotal = Math.round(wNum * formRate);
                const actualPaid = parseFloat(formAmount) || 0;
                const loss = wNum > 0 ? expectedTotal - actualPaid : 0;

                return (
                  <div className="space-y-3">
                    {/* Rate & Expected Price Info Box */}
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 font-mono">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Standard Rate:</span>
                        <span className="text-white font-bold">₹{formRate} / Kg</span>
                      </div>
                      <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
                        <span className="text-slate-400">Expected Customer Total:</span>
                        <span className="text-emerald-400 font-black text-sm">
                          ₹{expectedTotal.toLocaleString("en-IN")}
                        </span>
                      </div>
                      {wNum > 0 && (
                        <div className="text-[10px] text-slate-500">
                          Calculation: {wNum} Kg × ₹{formRate}/Kg = ₹{expectedTotal}
                        </div>
                      )}
                    </div>

                    {/* Row 4: Rate & Actual Amount Taken */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1">
                          Rate @/Kg (₹)
                        </label>
                        <input
                          type="number"
                          value={formRate}
                          onChange={(e) => {
                            setFormRate(parseFloat(e.target.value) || 0);
                            setFormAmountOverridden(false);
                          }}
                          required
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                            Amount Taken (₹) <span className="text-emerald-400">*</span>
                          </label>
                          {formAmountOverridden && (
                            <span className="text-[9px] text-amber-400 font-mono">Negotiated</span>
                          )}
                        </div>
                        <input
                          type="number"
                          value={formAmount}
                          onChange={(e) => {
                            setFormAmount(e.target.value);
                            setFormAmountOverridden(true);
                          }}
                          required
                          placeholder={`Expected: ₹${expectedTotal}`}
                          className="w-full bg-slate-950 border-2 border-cyan-500/50 rounded-xl px-3 py-2.5 text-base font-black text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Live Negotiation Loss Banner */}
                    {wNum > 0 && actualPaid > 0 && (
                      <div
                        className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                          loss > 0
                            ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                            : loss < 0
                            ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-300"
                            : "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">
                            {loss > 0 ? "trending_down" : loss < 0 ? "trending_up" : "check_circle"}
                          </span>
                          <span>
                            {loss > 0
                              ? "Negotiation Concession (Loss):"
                              : loss < 0
                              ? "Extra Paid (Premium):"
                              : "Price Status:"}
                          </span>
                        </div>
                        <span className="font-black text-sm">
                          {loss > 0 ? (
                            `-₹${loss.toLocaleString("en-IN")}`
                          ) : loss < 0 ? (
                            `+₹${Math.abs(loss).toLocaleString("en-IN")}`
                          ) : (
                            "Exact Full Price ✓"
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Row 5: Mode of Payment */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1.5">
                  Mode of Payment <span className="text-emerald-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "Cash", label: "💵 Cash", sub: "Counter Cash Drawer" },
                    { id: "Online Payment", label: "⚡ Online Payment", sub: "Soundbox UPI / QR / Card" },
                  ].map((m) => {
                    const isSel = formPayment === m.id || (m.id === "Online Payment" && formPayment !== "Cash");
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setFormPayment(m.id)}
                        className={`py-3 px-3 rounded-2xl font-bold text-xs transition-all cursor-pointer text-center ${
                          isSel
                            ? "bg-emerald-500/20 text-emerald-300 border-2 border-emerald-500 shadow-md shadow-emerald-950/40"
                            : "bg-slate-950/80 text-slate-400 border border-slate-700 hover:text-white"
                        }`}
                      >
                        <span className="block text-sm leading-tight font-black">{m.label}</span>
                        <span className="text-[10px] opacity-80 font-mono block mt-0.5">{m.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Custom Columns Fields */}
              {customColumns.filter((c) => c.visible).length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 font-mono block">
                    Additional Custom Fields
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {customColumns
                      .filter((c) => c.visible)
                      .map((c) => (
                        <div key={c.id}>
                          <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                            {c.name}
                          </label>
                          {c.type === "select" && c.options ? (
                            <select
                              value={formCustomFields[c.id] || ""}
                              onChange={(e) =>
                                setFormCustomFields({ ...formCustomFields, [c.id]: e.target.value })
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                            >
                              <option value="">Select...</option>
                              {c.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={c.type === "number" ? "number" : "text"}
                              value={formCustomFields[c.id] || ""}
                              onChange={(e) =>
                                setFormCustomFields({ ...formCustomFields, [c.id]: e.target.value })
                              }
                              placeholder={`Enter ${c.name}`}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                            />
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Row 6: Notes & Staff */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1">
                    Customer / Notes
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Suhail / 3 fish cleaned"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1">
                    Logged By
                  </label>
                  <input
                    type="text"
                    value={formLoggedBy}
                    onChange={(e) => setFormLoggedBy(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  {saving ? "Saving Entry…" : editingEntry ? "Update Entry" : "Save Sales Entry (✓)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL 2: DYNAMIC COLUMN BUILDER & MANAGER
          ══════════════════════════════════════════════════════════ */}
      {columnManagerOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setColumnManagerOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 sm:p-7 max-w-md w-full text-slate-200 shadow-2xl space-y-4 my-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 font-mono">
                  Table Customization
                </span>
                <h3
                  className="text-lg font-black text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  Dynamic Columns Manager
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setColumnManagerOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Standard Columns (Fixed) */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">
                Standard Fixed Columns:
              </span>
              <div className="flex flex-wrap gap-1 text-[11px] font-mono text-slate-400">
                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">Date</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">Time</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">Weight (Kg)</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">Type</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">Rate @/Kg</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">Amount Paid</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">Mode of Payment</span>
              </div>
            </div>

            {/* Custom User Columns List */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[10px] uppercase font-bold text-cyan-400 font-mono block">
                User-Defined Custom Columns:
              </span>

              {customColumns.length === 0 ? (
                <p className="text-xs text-slate-500 font-mono py-2">
                  No custom columns added yet. You can add columns like &quot;Customer Phone&quot;, &quot;Slip #&quot;, or &quot;Token&quot; below.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {customColumns.map((col) => (
                    <div
                      key={col.id}
                      className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleColVisibility(col.id)}
                          className={`p-1 rounded-md cursor-pointer transition-colors ${
                            col.visible ? "text-emerald-400 hover:text-emerald-300" : "text-slate-600 hover:text-slate-400"
                          }`}
                          title={col.visible ? "Visible in table (click to hide)" : "Hidden from table (click to show)"}
                        >
                          <span className="material-symbols-outlined text-base">
                            {col.visible ? "visibility" : "visibility_off"}
                          </span>
                        </button>
                        <div>
                          <strong className={col.visible ? "text-white" : "text-slate-500 line-through"}>
                            {col.name}
                          </strong>
                          <span className="text-[10px] text-slate-500 block">
                            Type: {col.type}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(col.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-red-400 cursor-pointer"
                        title="Delete Column"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form: Add New Dynamic Column */}
            <form onSubmit={handleAddColumn} className="space-y-3 pt-3 border-t border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-300 font-mono block">
                Add New Dynamic Column
              </span>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Column Name (e.g. Token #, Phone, Batch)"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                />

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "text", label: "Text" },
                    { id: "number", label: "Number" },
                    { id: "select", label: "Dropdown" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewColType(t.id as any)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        newColType === t.id
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {newColType === "select" && (
                  <input
                    type="text"
                    placeholder="Options separated by comma (e.g. VIP, Regular, Staff)"
                    value={newColOptions}
                    onChange={(e) => setNewColOptions(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                + Add Column to Table
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
