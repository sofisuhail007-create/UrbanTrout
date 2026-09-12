"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminClient";
import { CustomColumnDef, VendingSalesEntry } from "@/app/api/vending-log/route";
import { StaffIncentivePayout } from "@/app/api/vending-log/incentive/route";
import { AquariumStockEntry } from "@/app/api/aquarium-stock/route";
import { AquariumMortalityEntry } from "@/app/api/aquarium-mortality/route";
import { WorkerSalaryPayment, WorkerSalarySettings } from "@/app/api/vending-log/salary/route";
import * as XLSX from "xlsx";
import BalanceReminderModal from "../billing/BalanceReminderModal";
import type { CustomerBalanceRecord } from "@/app/api/customer-balance/route";

const DEFAULT_GUTTED_PRICE = 580;
const DEFAULT_NON_GUTTED_PRICE = 540;
const INCENTIVE_RATE_PER_KG = 5; // RS 5 per kg for gutted trout only

const ROOT_OWNER_EMAILS = ["sofisuhail007@gmail.com", "info.urbantrout@gmail.com"];

const isEmailAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return ROOT_OWNER_EMAILS.includes(email.trim().toLowerCase());
};

// Exact weight formatter helper - preserves 3 decimal precision (e.g. 2.155 stays 2.155)
export const formatKg = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === "") return "0.000";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num.toFixed(3);
};

// Canonical Indian Standard Time (Asia/Kolkata) date helpers
export const getIstTodayDate = (): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch (_) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
};

export const getIstCurrentTime = (): string => {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch (_) {
    return new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
};

export const formatIstDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return dateStr;
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return dt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (_) {
    return dateStr;
  }
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

-- Ensure columns exist if table was created with older schema
ALTER TABLE public.vending_sales_log ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(10, 2);
ALTER TABLE public.vending_sales_log ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00;

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

  // Admin access control (metric cards strictly hidden for staff)
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminCards, setShowAdminCards] = useState(true);

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

  // ─── Aquarium Stock (Biomass Procurement) State ───
  const [stockEntries, setStockEntries] = useState<AquariumStockEntry[]>([]);
  const [stockTableAvailable, setStockTableAvailable] = useState(true);
  const [stockLogOpen, setStockLogOpen] = useState(false); // collapsible section
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [deleteStockConfirmId, setDeleteStockConfirmId] = useState<string | null>(null);

  // Authoritative server date synchronized from API (Asia/Kolkata)
  const [serverTodayDate, setServerTodayDate] = useState<string>(() => getIstTodayDate());
  const [serverDateFormatted, setServerDateFormatted] = useState<string>(() =>
    formatIstDateDisplay(getIstTodayDate())
  );

  const getTodayDate = useCallback(() => {
    return serverTodayDate || getIstTodayDate();
  }, [serverTodayDate]);

  const getCurrentTime = useCallback(() => {
    return getIstCurrentTime();
  }, []);

  // Stock form state
  const [stockFormDate, setStockFormDate] = useState(() => getIstTodayDate());
  const [stockFormTime, setStockFormTime] = useState(() => getIstCurrentTime());
  const [stockFormSupplier, setStockFormSupplier] = useState("Khyber Aquaculture");
  const [stockFormType, setStockFormType] = useState<"Gutted" | "Non Gutted">("Non Gutted");
  const [stockFormWeight, setStockFormWeight] = useState("");
  const [stockFormCost, setStockFormCost] = useState("350");
  const [stockFormNotes, setStockFormNotes] = useState("");

  // Entry Form State
  const [formDate, setFormDate] = useState(() => getIstTodayDate());
  const [formTime, setFormTime] = useState(() => getIstCurrentTime());

  // Staff Incentive Payouts State
  const [payouts, setPayouts] = useState<StaffIncentivePayout[]>([]);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutFormAmount, setPayoutFormAmount] = useState("");
  const [payoutFormDate, setPayoutFormDate] = useState(getTodayDate());
  const [payoutFormTime, setPayoutFormTime] = useState(getCurrentTime());
  const [payoutFormMode, setPayoutFormMode] = useState("Cash");
  const [payoutFormRecipient, setPayoutFormRecipient] = useState("Counter Staff");
  const [payoutFormNotes, setPayoutFormNotes] = useState("");
  const [deletePayoutConfirmId, setDeletePayoutConfirmId] = useState<string | null>(null);

  // ─── Worker Salary Management State (Mohd Amin) ───
  const [salaryPayments, setSalaryPayments] = useState<WorkerSalaryPayment[]>([]);
  const [salaryConfig, setSalaryConfig] = useState<WorkerSalarySettings>({
    worker_name: "Mohd Amin",
    base_monthly_salary: 15000,
  });
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryFormAmount, setSalaryFormAmount] = useState("");
  const [salaryFormMonth, setSalaryFormMonth] = useState(() =>
    new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
  );
  const [salaryFormDate, setSalaryFormDate] = useState(getTodayDate());
  const [salaryFormTime, setSalaryFormTime] = useState(getCurrentTime());
  const [salaryFormMode, setSalaryFormMode] = useState("Cash");
  const [salaryFormNotes, setSalaryFormNotes] = useState("");
  const [deleteSalaryConfirmId, setDeleteSalaryConfirmId] = useState<string | null>(null);
  const [editingBaseSalary, setEditingBaseSalary] = useState(false);
  const [editingBaseSalaryCard, setEditingBaseSalaryCard] = useState(false);
  const [baseSalaryInput, setBaseSalaryInput] = useState("15000");
  const [formType, setFormType] = useState<"Gutted" | "Non Gutted" | string>("Gutted");
  const [formWeight, setFormWeight] = useState<string>("");
  const [formRate, setFormRate] = useState<number>(DEFAULT_GUTTED_PRICE);
  const [formAmount, setFormAmount] = useState<string>("");
  const [formAmountOverridden, setFormAmountOverridden] = useState(false);
  const [formPayment, setFormPayment] = useState<string>("Cash");
  const [formCustomFields, setFormCustomFields] = useState<Record<string, any>>({});
  const [formNotes, setFormNotes] = useState("");
  const [formLoggedBy, setFormLoggedBy] = useState("Counter Staff");

  // ─── Customer Balance & Khata State (Vending Center) ───
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formCustomerPhone, setFormCustomerPhone] = useState("");
  const [formBalanceAction, setFormBalanceAction] = useState<"balance" | "final_settlement" | "none">("final_settlement");
  const [selectedBalanceRecord, setSelectedBalanceRecord] = useState<CustomerBalanceRecord | null>(null);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);

  // ─── Aquarium Mortality & Scrap Wastage State ───
  const [mortalityEntries, setMortalityEntries] = useState<AquariumMortalityEntry[]>([]);
  const [mortalityModalOpen, setMortalityModalOpen] = useState(false);
  const [savingMortality, setSavingMortality] = useState(false);
  const [showMortalityTable, setShowMortalityTable] = useState(false);
  const [deleteMortalityConfirmId, setDeleteMortalityConfirmId] = useState<string | null>(null);

  // Mortality Form State
  const [mortalityFormDate, setMortalityFormDate] = useState(getTodayDate());
  const [mortalityFormTime, setMortalityFormTime] = useState(getCurrentTime());
  const [mortalityFormWeight, setMortalityFormWeight] = useState("");
  const [mortalityFormCount, setMortalityFormCount] = useState("1");
  const [mortalityFormReason, setMortalityFormReason] = useState("Natural Mortality");
  const [mortalityFormNotes, setMortalityFormNotes] = useState("");
  const [mortalityFormLoggedBy, setMortalityFormLoggedBy] = useState("Mohd Amin");

  // ─── End-of-Day (EOD) Telegram Report State ───
  const [eodModalOpen, setEodModalOpen] = useState(false);
  const [sendingEodReport, setSendingEodReport] = useState(false);
  const [eodCustomNote, setEodCustomNote] = useState("");
  const [eodPreviewHtml, setEodPreviewHtml] = useState("");
  const [eodSuccessNotice, setEodSuccessNotice] = useState<string | null>(null);

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
      // Purge any stale legacy localStorage caches
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("ut_vending_sales_log_cache");
          localStorage.removeItem("ut_vending_server_date");
        } catch (_) {}
      }

      // Fetch fresh real-time data from API
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
          if (data.serverDate && /^\d{4}-\d{2}-\d{2}$/.test(data.serverDate)) {
            setServerTodayDate(data.serverDate);
            if (data.serverDateFormatted) {
              setServerDateFormatted(data.serverDateFormatted);
            } else {
              setServerDateFormatted(formatIstDateDisplay(data.serverDate));
            }
          }
          setEntries(data.entries || []);
          setCustomColumns(data.customColumns || []);
          setIsTableAvailable(data.isTableAvailable ?? true);
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

  // ─── Fetch Staff Incentive Payouts (Admin Only) ───
  const fetchPayouts = useCallback(async () => {
    try {
      const res = await adminFetch("/api/vending-log/incentive");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.payouts)) {
          setPayouts(data.payouts);
        }
      }
    } catch (err) {
      console.warn("Could not fetch incentive payouts:", err);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchPayouts();
    }
  }, [isAdmin, fetchPayouts]);

  // Read stored staff email for formLoggedBy
  useEffect(() => {
    try {
      const email = localStorage.getItem("ut_admin_email");
      if (email) setFormLoggedBy(email.split("@")[0]);
    } catch (_) {}
  }, []);

  // ─── Determine if current user is Admin (Staff cannot see financial aggregate cards) ───
  useEffect(() => {
    let active = true;

    const checkAdminStatus = async () => {
      try {
        // 1. Immediate local/session storage check for fast rendering without flashing
        const storedEmail = (localStorage.getItem("ut_admin_email") || sessionStorage.getItem("ut_admin_email") || "").toLowerCase().trim();
        const storedRole = (localStorage.getItem("ut_admin_role") || sessionStorage.getItem("ut_admin_role") || "").toLowerCase().trim();
        const storedPerms = localStorage.getItem("ut_admin_permissions") || sessionStorage.getItem("ut_admin_permissions");

        let locallyAdmin = isEmailAdmin(storedEmail) || storedRole === "super_admin" || storedRole === "admin";
        if (!locallyAdmin && storedPerms) {
          try {
            const parsed = JSON.parse(storedPerms);
            if (parsed.analytics && parsed.settings) locallyAdmin = true;
          } catch (_) {}
        }

        if (locallyAdmin && active) {
          setIsAdmin(true);
        }

        // 2. Validate against live Supabase Auth session & app_settings to prevent tampering
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;

        if (user?.email) {
          const userEmail = user.email.toLowerCase().trim();
          if (isEmailAdmin(userEmail)) {
            setIsAdmin(true);
            return;
          }

          // Check database staff_permissions list
          const { data: staffRow } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "staff_permissions")
            .maybeSingle();

          if (!active) return;

          if (staffRow?.value) {
            try {
              const parsed = JSON.parse(staffRow.value);
              if (Array.isArray(parsed)) {
                const member = parsed.find((s: any) => s.email?.toLowerCase().trim() === userEmail);
                if (member) {
                  const role = (member.role || "").toLowerCase().trim();
                  const isStaffAdmin = role === "super_admin" || role === "admin";
                  setIsAdmin(isStaffAdmin);
                  return;
                }
              }
            } catch (_) {}
          }

          // Fallback whitelist check
          const { data: whitelistRow } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "admin_whitelist")
            .maybeSingle();

          if (!active) return;

          if (whitelistRow?.value) {
            const allowed = whitelistRow.value.split(",").map((e: string) => e.trim().toLowerCase());
            if (allowed.includes(userEmail)) {
              // admin_whitelist users without super_admin role are treated as staff
              setIsAdmin(false);
              return;
            }
          }

          // If user email doesn't match root admin or super_admin role, revoke admin cards
          setIsAdmin(false);
        } else if (!locallyAdmin) {
          setIsAdmin(false);
        }
      } catch (err) {
        console.warn("Could not verify admin status:", err);
      }
    };

    checkAdminStatus();

    return () => {
      active = false;
    };
  }, []);

  // ─── Fetch Aquarium Stock Procurement Entries ───
  const fetchStockEntries = useCallback(async () => {
    try {
      const res = await adminFetch("/api/aquarium-stock");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStockEntries(data.entries || []);
          setStockTableAvailable(data.isTableAvailable ?? true);
        }
      }
    } catch (err) {
      console.warn("Could not fetch aquarium stock entries:", err);
    }
  }, []);

  useEffect(() => {
    fetchStockEntries();
  }, [fetchStockEntries]);

  // ─── Fetch Worker Salary Payments (Mohd Amin) ───
  const fetchSalaryPayments = useCallback(async () => {
    try {
      const res = await adminFetch("/api/vending-log/salary");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSalaryPayments(data.payments || []);
          if (data.config) {
            setSalaryConfig(data.config);
            setBaseSalaryInput(String(data.config.base_monthly_salary || 15000));
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch worker salary payments:", err);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchSalaryPayments();
    }
  }, [isAdmin, fetchSalaryPayments]);

  // ─── Fetch Aquarium Mortality Logs ───
  const fetchMortalityEntries = useCallback(async () => {
    try {
      const res = await adminFetch("/api/aquarium-mortality");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.entries)) {
          setMortalityEntries(data.entries);
        }
      }
    } catch (err) {
      console.warn("Could not fetch aquarium mortality entries:", err);
    }
  }, []);

  useEffect(() => {
    fetchMortalityEntries();
  }, [fetchMortalityEntries]);

  // ─── Period Calculations ───
  const filteredEntriesByPeriod = useMemo(() => {
    const todayStr = getTodayDate();
    const parts = todayStr.split("-").map(Number);
    const currDate =
      parts.length === 3 && parts[0] && parts[1] && parts[2]
        ? new Date(parts[0], parts[1] - 1, parts[2])
        : new Date();

    // Rolling 7 Days in IST (includes today, yesterday, and 5 previous days)
    const sevenDaysAgo = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // 1st of current month in IST
    const firstOfMonth = new Date(currDate.getFullYear(), currDate.getMonth(), 1);

    return entries.filter((e) => {
      // Parse as LOCAL date components to avoid UTC→IST offset shifting the date by -5:30h
      const [ey, em, ed] = e.entry_date.split("-").map(Number);
      const eDate = new Date(ey, em - 1, ed);
      if (period === "today") return e.entry_date === todayStr;
      if (period === "week") return eDate >= sevenDaysAgo;
      if (period === "month") return eDate >= firstOfMonth;
      if (period === "custom") {
        if (customStartDate && e.entry_date < customStartDate) return false;
        if (customEndDate && e.entry_date > customEndDate) return false;
        return true;
      }
      return true; // "all"
    });
  }, [entries, period, customStartDate, customEndDate, getTodayDate]);

  // ─── Weighted Average Procurement Cost per Kg across all stock batches ───
  const procurementAvgCost = useMemo(() => {
    let totalProcuredKg = 0;
    let totalProcuredCost = 0;
    stockEntries.forEach((s) => {
      const w = Number(s.weight_kg) || 0;
      const cost = Number(s.cost_per_kg) || 0;
      totalProcuredKg = Math.round((totalProcuredKg + w) * 1000) / 1000;
      totalProcuredCost += w * cost;
    });
    return totalProcuredKg > 0 ? Math.round(totalProcuredCost / totalProcuredKg) : 350;
  }, [stockEntries]);

  // ─── KPI Metrics (Computed on period filtered entries) ───
  const kpis = useMemo(() => {
    let totalKg = 0;
    let totalRevenue = 0;
    let totalExpected = 0;
    let totalLoss = 0;
    let pendingBalanceTotal = 0;
    let pendingBalanceCount = 0;
    let guttedKg = 0;
    let nonGuttedKg = 0;
    let guttedRevenue = 0;
    let nonGuttedRevenue = 0;
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

      const bal = Number(e.custom_fields?.balance_amount || 0);
      if (bal > 0 && e.custom_fields?.balance_status === "pending") {
        pendingBalanceTotal += bal;
        pendingBalanceCount += 1;
      }

      totalKg = Math.round((totalKg + w) * 1000) / 1000;
      totalRevenue += rev;
      totalExpected += exp;
      totalLoss += loss;

      const isGutted =
        (e.product_type || "").toLowerCase().includes("gutted") &&
        !(e.product_type || "").toLowerCase().includes("non");
      if (isGutted) {
        guttedKg = Math.round((guttedKg + w) * 1000) / 1000;
        guttedRevenue += rev;
      } else {
        nonGuttedKg = Math.round((nonGuttedKg + w) * 1000) / 1000;
        nonGuttedRevenue += rev;
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

    // Realized Profit on sold fishes (based on procurement cost)
    const guttedCost = Math.round(guttedKg * procurementAvgCost);
    const nonGuttedCost = Math.round(nonGuttedKg * procurementAvgCost);
    const guttedProfit = Math.round(guttedRevenue - guttedCost);
    const nonGuttedProfit = Math.round(nonGuttedRevenue - nonGuttedCost);
    const totalSoldProfit = guttedProfit + nonGuttedProfit;
    const profitMarginPercent =
      totalRevenue > 0 ? ((totalSoldProfit / totalRevenue) * 100).toFixed(1) : "0.0";
    const avgProfitPerKg = totalKg > 0 ? Math.round(totalSoldProfit / totalKg) : 0;

    return {
      totalKg,
      totalRevenue,
      totalExpected,
      totalLoss,
      lossPercent,
      pendingBalanceTotal,
      pendingBalanceCount,
      guttedKg,
      nonGuttedKg,
      guttedRevenue,
      nonGuttedRevenue,
      guttedCost,
      nonGuttedCost,
      guttedProfit,
      nonGuttedProfit,
      totalSoldProfit,
      profitMarginPercent,
      avgProfitPerKg,
      procurementAvgCost,
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
  }, [filteredEntriesByPeriod, procurementAvgCost]);

  // ─── Staff Gutted Trout Incentive Tracker (₹5/Kg Gutted Only) ───
  const incentiveStats = useMemo(() => {
    // 1. All-time Gutted Trout Weight across all entries
    let allTimeGuttedKg = 0;
    entries.forEach((e) => {
      const isGutted =
        (e.product_type || "").toLowerCase().includes("gutted") &&
        !(e.product_type || "").toLowerCase().includes("non");
      if (isGutted) {
        allTimeGuttedKg = Math.round((allTimeGuttedKg + (Number(e.weight_kg) || 0)) * 1000) / 1000;
      }
    });

    // 2. Current period gutted trout weight
    const periodGuttedKg = kpis.guttedKg;

    // 3. Incentive amounts (at ₹5/Kg)
    const allTimeEarned = Math.round(allTimeGuttedKg * INCENTIVE_RATE_PER_KG);
    const periodEarned = Math.round(periodGuttedKg * INCENTIVE_RATE_PER_KG);

    // 4. Total paid disbursements from ledger
    const totalPaid = payouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // 5. Remaining amount owed to staff worker
    const balanceRemaining = Math.max(0, Math.round(allTimeEarned - totalPaid));

    return {
      allTimeGuttedKg,
      periodGuttedKg,
      allTimeEarned,
      periodEarned,
      totalPaid,
      balanceRemaining,
    };
  }, [entries, kpis.guttedKg, payouts]);

  // ─── Worker Salary Stats (Mohd Amin) ───
  const salaryStats = useMemo(() => {
    const currentMonthLabel = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
    const thisMonthPaid = salaryPayments
      .filter((p) => (p.salary_month || "").toLowerCase() === currentMonthLabel.toLowerCase())
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const allTimePaid = salaryPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const baseMonthly = salaryConfig.base_monthly_salary || 15000;
    const monthBalanceDue = Math.max(0, baseMonthly - thisMonthPaid);

    return {
      workerName: salaryConfig.worker_name || "Mohd Amin",
      baseMonthly,
      thisMonthPaid,
      allTimePaid,
      monthBalanceDue,
      currentMonthLabel,
    };
  }, [salaryPayments, salaryConfig]);

  // ─── Aquarium Live Stock Calculations ───
  // All stock procured is LIVE FISH. We track what's left in the aquarium.
  // Remaining = total procured (live kg) − total vending sales (all types combined)
  const aquariumStock = useMemo(() => {
    // All-time total sold from vending log (gutted + non-gutted combined — all came from the aquarium)
    let allTimeSoldKg = 0;
    entries.forEach((e) => {
      allTimeSoldKg = Math.round((allTimeSoldKg + (Number(e.weight_kg) || 0)) * 1000) / 1000;
    });

    // Total live fish procured and total procurement cost
    let totalProcuredKg = 0;
    let totalProcuredCost = 0;
    stockEntries.forEach((s) => {
      const w = Number(s.weight_kg) || 0;
      const cost = Number(s.cost_per_kg) || 0;
      totalProcuredKg = Math.round((totalProcuredKg + w) * 1000) / 1000;
      totalProcuredCost += w * cost;
    });

    // Total live fish mortality and scrap loss
    let totalMortalityKg = 0;
    let totalMortalityCount = 0;
    let todayMortalityKg = 0;
    let todayMortalityCount = 0;
    const todayDateStr = getTodayDate();

    mortalityEntries.forEach((m) => {
      const mw = Number(m.weight_kg) || 0;
      const mc = Number(m.fish_count) || 1;
      totalMortalityKg = Math.round((totalMortalityKg + mw) * 1000) / 1000;
      totalMortalityCount += mc;
      if (m.mortality_date === todayDateStr) {
        todayMortalityKg = Math.round((todayMortalityKg + mw) * 1000) / 1000;
        todayMortalityCount += mc;
      }
    });

    // Live fish remaining in aquarium (Procured − Sold − Mortality)
    const remainingKg = Math.max(
      0,
      Math.round((totalProcuredKg - allTimeSoldKg - totalMortalityKg) * 1000) / 1000
    );

    // Gone from aquarium = sold already
    const soldKg = Math.min(allTimeSoldKg, totalProcuredKg);

    // Value of remaining stock if ALL sold as Gutted
    const valueIfGutted = Math.round(remainingKg * guttedPrice);

    // Value of remaining stock if ALL sold as Non-Gutted
    const valueIfNonGutted = Math.round(remainingKg * nonGuttedPrice);

    // Avg procurement cost per kg
    const avgCostPerKg = totalProcuredKg > 0 ? totalProcuredCost / totalProcuredKg : 350;

    // Financial loss due to mortality
    const totalMortalityCost = Math.round(totalMortalityKg * avgCostPerKg);
    const todayMortalityCost = Math.round(todayMortalityKg * avgCostPerKg);
    const mortalityRatePercent =
      totalProcuredKg > 0 ? ((totalMortalityKg / totalProcuredKg) * 100).toFixed(1) : "0.0";

    // Procurement cost of remaining stock
    const procurementCostRemaining = Math.round(remainingKg * avgCostPerKg);

    // Expected Profit = Revenue if sold − Procurement cost
    const expectedProfitGutted = Math.max(0, Math.round(remainingKg * (guttedPrice - avgCostPerKg)));
    const expectedProfitNonGutted = Math.max(0, Math.round(remainingKg * (nonGuttedPrice - avgCostPerKg)));

    return {
      totalProcuredKg,
      totalProcuredCost: Math.round(totalProcuredCost),
      soldKg,
      remainingKg,
      totalMortalityKg,
      totalMortalityCount,
      totalMortalityCost,
      todayMortalityKg,
      todayMortalityCount,
      todayMortalityCost,
      mortalityRatePercent,
      mortalityCount: mortalityEntries.length,
      valueIfGutted,
      valueIfNonGutted,
      expectedProfitGutted,
      expectedProfitNonGutted,
      avgCostPerKg: Math.round(avgCostPerKg),
      procurementCostRemaining,
      batchCount: stockEntries.length,
    };
  }, [entries, stockEntries, mortalityEntries, guttedPrice, nonGuttedPrice]);

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
    setFormCustomerName("");
    setFormCustomerPhone("");
    setFormBalanceAction("final_settlement");
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
    if (isNaN(amt) || amt < 0) {
      alert("Please enter a valid Amount Paid (₹0 or more).");
      return;
    }

    const calculatedExpected = Math.round(w * formRate);
    const expected = calculatedExpected;
    const difference = Math.max(0, expected - amt);

    if (formBalanceAction === "balance" && difference > 0) {
      if (!formCustomerPhone.trim()) {
        alert("Please enter Customer Phone Number (WhatsApp) so balance reminders & Razorpay QR can be sent.");
        return;
      }
    }

    let finalDiscount = 0;
    let balanceAmount = 0;
    let balanceStatus: "pending" | "waived_final" | "none" = "none";
    let balanceRefId = editingEntry?.custom_fields?.balance_ref_id;

    if (formBalanceAction === "balance" && difference > 0) {
      balanceAmount = difference;
      balanceStatus = "pending";
      finalDiscount = 0; // Customer owes this balance, not a concession!
      if (!balanceRefId) {
        balanceRefId = `VL-${formDate.replace(/\D/g, "")}-${Date.now().toString().slice(-4)}`;
      }
    } else if (formBalanceAction === "final_settlement" && difference > 0) {
      balanceAmount = 0;
      balanceStatus = "waived_final";
      finalDiscount = difference; // Full difference conceded as courtesy discount
    } else {
      balanceAmount = 0;
      balanceStatus = "none";
      finalDiscount = Math.max(0, expected - amt);
    }

    const updatedCustomFields = {
      ...(formCustomFields || {}),
      balance_amount: balanceAmount,
      balance_status: balanceStatus,
      balance_ref_id: balanceRefId || null,
      customer_name: formCustomerName.trim() || undefined,
      customer_phone: formCustomerPhone.trim() || undefined,
    };

    setSaving(true);
    try {
      // Sync customer balance record to backend
      if (balanceStatus === "pending" && balanceAmount > 0 && balanceRefId) {
        try {
          await fetch("/api/customer-balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceId: balanceRefId,
              customerName: formCustomerName.trim() || "Counter Customer",
              customerPhone: formCustomerPhone.trim(),
              totalAmount: expected,
              paidAmount: amt,
              balanceAmount: balanceAmount,
              status: "pending",
              paymentMethod: formPayment,
              settlementNote: `Vending Center Sale: ${w} Kg ${formType} Trout`,
              itemsSummary: `${w} Kg ${formType} Trout (Vending Center)`,
            }),
          });
        } catch (e) {
          console.warn("Failed to sync customer balance record:", e);
        }
      } else if (balanceRefId && (balanceStatus === "waived_final" || balanceStatus === "none" || formBalanceAction === "none")) {
        try {
          if (formBalanceAction === "none") {
            await fetch(`/api/customer-balance?id=${encodeURIComponent(balanceRefId)}`, {
              method: "DELETE",
            });
          } else {
            await fetch("/api/customer-balance", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: balanceRefId,
                action: "SETTLE_FINAL_WAIVER",
                settlementNote: "Agreed Final Settlement / Concession Discount in Vending Log",
              }),
            });
          }
        } catch (e) {
          console.warn("Failed to update/remove customer balance record:", e);
        }
      }

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
          discount_amount: finalDiscount,
          payment_mode: formPayment,
          custom_fields: updatedCustomFields,
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
          discount_amount: finalDiscount,
          payment_mode: formPayment,
          custom_fields: updatedCustomFields,
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

  // ─── Staff Incentive Payout Handlers ───
  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payoutFormAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid payout amount greater than ₹0.");
      return;
    }

    setSavingPayout(true);
    try {
      const res = await adminFetch("/api/vending-log/incentive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payout_date: payoutFormDate,
          payout_time: payoutFormTime,
          amount,
          payment_mode: payoutFormMode,
          recipient_name: payoutFormRecipient,
          notes: payoutFormNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.payout) {
          setPayouts((prev) => [data.payout, ...prev]);
          setPayoutFormAmount("");
          setPayoutFormNotes("");
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to record payout.");
      }
    } catch (err) {
      console.error("Error saving payout:", err);
      alert("Failed to record payout. Please try again.");
    } finally {
      setSavingPayout(false);
    }
  };

  const handleDeletePayout = async (id: string) => {
    try {
      const res = await adminFetch(`/api/vending-log/incentive?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPayouts((prev) => prev.filter((p) => p.id !== id));
        setDeletePayoutConfirmId(null);
      }
    } catch (err) {
      console.error("Failed to delete payout:", err);
    }
  };

  // ─── Aquarium Stock Log Handlers ───
  const handleAddStockEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(stockFormWeight);
    const cost = parseFloat(stockFormCost);

    if (isNaN(w) || w <= 0) {
      alert("Please enter a valid weight in Kg.");
      return;
    }
    if (isNaN(cost) || cost <= 0) {
      alert("Please enter a valid cost per Kg.");
      return;
    }

    setSavingStock(true);
    try {
      const loggedBy = localStorage.getItem("ut_admin_email")?.split("@")[0] || "Admin";
      const res = await adminFetch("/api/aquarium-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_date: stockFormDate,
          stock_time: stockFormTime,
          supplier_name: stockFormSupplier.trim() || "Khyber Aquaculture",
          product_type: "Live Fish",
          weight_kg: w,
          cost_per_kg: cost,
          batch_notes: stockFormNotes.trim() || null,
          logged_by: loggedBy,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.entry) {
          setStockEntries((prev) => [data.entry, ...prev]);
          setStockModalOpen(false);
          setStockFormWeight("");
          setStockFormNotes("");
          setStockFormDate(getTodayDate());
          setStockFormTime(getCurrentTime());
          setStockTableAvailable(true);
          playLogChime();
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to save stock entry.");
      }
    } catch (err) {
      console.error("Error saving stock entry:", err);
      alert("Failed to save stock entry. Please check connection.");
    } finally {
      setSavingStock(false);
    }
  };

  const handleDeleteStockEntry = async (id: string) => {
    try {
      const res = await adminFetch(`/api/aquarium-stock?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStockEntries((prev) => prev.filter((s) => s.id !== id));
        setDeleteStockConfirmId(null);
      }
    } catch (err) {
      console.error("Failed to delete stock entry:", err);
    }
  };

  // ─── Aquarium Mortality Handlers ───
  const handleAddMortalityEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(mortalityFormWeight);
    if (!w || isNaN(w) || w <= 0) {
      alert("Please enter a valid mortality weight in Kg.");
      return;
    }
    const count = parseInt(mortalityFormCount, 10) || 1;

    setSavingMortality(true);
    try {
      const loggedBy = localStorage.getItem("ut_admin_email")?.split("@")[0] || mortalityFormLoggedBy || "Mohd Amin";
      const res = await adminFetch("/api/aquarium-mortality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mortality_date: mortalityFormDate,
          mortality_time: mortalityFormTime,
          weight_kg: w,
          fish_count: count,
          reason: mortalityFormReason,
          notes: mortalityFormNotes.trim() || null,
          logged_by: loggedBy,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.entry) {
          setMortalityEntries((prev) => [data.entry, ...prev]);
          setMortalityModalOpen(false);
          setMortalityFormWeight("");
          setMortalityFormCount("1");
          setMortalityFormNotes("");
          setMortalityFormDate(getTodayDate());
          setMortalityFormTime(getCurrentTime());
          playLogChime();
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to record mortality log.");
      }
    } catch (err) {
      console.error("Error saving mortality entry:", err);
      alert("Failed to save mortality log. Please check connection.");
    } finally {
      setSavingMortality(false);
    }
  };

  const handleDeleteMortalityEntry = async (id: string) => {
    try {
      const res = await adminFetch(`/api/aquarium-mortality?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMortalityEntries((prev) => prev.filter((m) => m.id !== id));
        setDeleteMortalityConfirmId(null);
      }
    } catch (err) {
      console.error("Failed to delete mortality entry:", err);
    }
  };

  // ─── EOD Telegram Report Handlers ───
  const handleOpenEodModal = async () => {
    setEodModalOpen(true);
    setEodSuccessNotice(null);
    setEodPreviewHtml("Loading today's report preview...");

    const todayStr = getTodayDate();
    const todayEntries = entries.filter((e) => e.entry_date === todayStr);

    let totalSoldKg = 0;
    let guttedSoldKg = 0;
    let nonGuttedSoldKg = 0;
    let grossRevenue = 0;
    let expectedRevenue = 0;
    let negotiationLoss = 0;
    let cashRevenue = 0;
    let cashCount = 0;
    let onlineRevenue = 0;
    let onlineCount = 0;

    todayEntries.forEach((e) => {
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

      totalSoldKg = Math.round((totalSoldKg + w) * 1000) / 1000;
      grossRevenue += rev;
      expectedRevenue += exp;
      negotiationLoss += loss;

      const isGutted =
        (e.product_type || "").toLowerCase().includes("gutted") &&
        !(e.product_type || "").toLowerCase().includes("non");
      if (isGutted) {
        guttedSoldKg = Math.round((guttedSoldKg + w) * 1000) / 1000;
      } else {
        nonGuttedSoldKg = Math.round((nonGuttedSoldKg + w) * 1000) / 1000;
      }

      const isCash = (e.payment_mode || "").toLowerCase().trim() === "cash";
      if (isCash) {
        cashRevenue += rev;
        cashCount += 1;
      } else {
        onlineRevenue += rev;
        onlineCount += 1;
      }
    });

    const guttedCost = Math.round(guttedSoldKg * procurementAvgCost);
    const nonGuttedCost = Math.round(nonGuttedSoldKg * procurementAvgCost);
    const totalCost = guttedCost + nonGuttedCost;
    const netRealizedProfit = grossRevenue - totalCost;
    const profitMarginPercent =
      grossRevenue > 0 ? ((netRealizedProfit / grossRevenue) * 100).toFixed(1) : "0.0";

    const payload = {
      reportDate: new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Kolkata",
      }),
      totalSoldKg,
      guttedSoldKg,
      nonGuttedSoldKg,
      grossRevenue,
      expectedRevenue,
      netRealizedProfit,
      profitMarginPercent,
      onlineRevenue,
      onlineCount,
      cashRevenue,
      cashCount,
      negotiationLoss,
      totalBills: todayEntries.length,
      liveStockRemainingKg: aquariumStock.remainingKg,
      stockWorthGutted: aquariumStock.valueIfGutted,
      stockWorthNonGutted: aquariumStock.valueIfNonGutted,
      todayMortalityKg: aquariumStock.todayMortalityKg,
      todayMortalityCost: aquariumStock.todayMortalityCost,
      todayMortalityCount: aquariumStock.todayMortalityCount,
      aminDailyIncentive: Math.round(guttedSoldKg * INCENTIVE_RATE_PER_KG),
      aminIncentivePending: incentiveStats.balanceRemaining,
      aminSalaryMonthPaid: salaryStats.thisMonthPaid,
      aminSalaryBalanceDue: salaryStats.monthBalanceDue,
      aminBaseSalary: salaryStats.baseMonthly,
      customNote: eodCustomNote,
      previewOnly: true,
    };

    try {
      const res = await adminFetch("/api/vending-log/eod-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.previewHtml) {
          setEodPreviewHtml(data.previewHtml);
        }
      }
    } catch (err) {
      console.error("Failed to generate EOD preview:", err);
    }
  };

  const handleSendEodReport = async () => {
    setSendingEodReport(true);
    setEodSuccessNotice(null);

    const todayStr = getTodayDate();
    const todayEntries = entries.filter((e) => e.entry_date === todayStr);

    let totalSoldKg = 0;
    let guttedSoldKg = 0;
    let nonGuttedSoldKg = 0;
    let grossRevenue = 0;
    let expectedRevenue = 0;
    let negotiationLoss = 0;
    let cashRevenue = 0;
    let cashCount = 0;
    let onlineRevenue = 0;
    let onlineCount = 0;

    todayEntries.forEach((e) => {
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

      totalSoldKg = Math.round((totalSoldKg + w) * 1000) / 1000;
      grossRevenue += rev;
      expectedRevenue += exp;
      negotiationLoss += loss;

      const isGutted =
        (e.product_type || "").toLowerCase().includes("gutted") &&
        !(e.product_type || "").toLowerCase().includes("non");
      if (isGutted) {
        guttedSoldKg = Math.round((guttedSoldKg + w) * 1000) / 1000;
      } else {
        nonGuttedSoldKg = Math.round((nonGuttedSoldKg + w) * 1000) / 1000;
      }

      const isCash = (e.payment_mode || "").toLowerCase().trim() === "cash";
      if (isCash) {
        cashRevenue += rev;
        cashCount += 1;
      } else {
        onlineRevenue += rev;
        onlineCount += 1;
      }
    });

    const guttedCost = Math.round(guttedSoldKg * procurementAvgCost);
    const nonGuttedCost = Math.round(nonGuttedSoldKg * procurementAvgCost);
    const totalCost = guttedCost + nonGuttedCost;
    const netRealizedProfit = grossRevenue - totalCost;
    const profitMarginPercent =
      grossRevenue > 0 ? ((netRealizedProfit / grossRevenue) * 100).toFixed(1) : "0.0";

    const payload = {
      reportDate: new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Kolkata",
      }),
      totalSoldKg,
      guttedSoldKg,
      nonGuttedSoldKg,
      grossRevenue,
      expectedRevenue,
      netRealizedProfit,
      profitMarginPercent,
      onlineRevenue,
      onlineCount,
      cashRevenue,
      cashCount,
      negotiationLoss,
      totalBills: todayEntries.length,
      liveStockRemainingKg: aquariumStock.remainingKg,
      stockWorthGutted: aquariumStock.valueIfGutted,
      stockWorthNonGutted: aquariumStock.valueIfNonGutted,
      todayMortalityKg: aquariumStock.todayMortalityKg,
      todayMortalityCost: aquariumStock.todayMortalityCost,
      todayMortalityCount: aquariumStock.todayMortalityCount,
      aminDailyIncentive: Math.round(guttedSoldKg * INCENTIVE_RATE_PER_KG),
      aminIncentivePending: incentiveStats.balanceRemaining,
      aminSalaryMonthPaid: salaryStats.thisMonthPaid,
      aminSalaryBalanceDue: salaryStats.monthBalanceDue,
      aminBaseSalary: salaryStats.baseMonthly,
      customNote: eodCustomNote,
      previewOnly: false,
    };

    try {
      const res = await adminFetch("/api/vending-log/eod-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEodSuccessNotice("✓ EOD Report successfully delivered to Telegram!");
        playLogChime();
        setTimeout(() => {
          setEodModalOpen(false);
          setEodSuccessNotice(null);
          setEodCustomNote("");
        }, 2200);
      } else {
        alert(data.error || "Failed to deliver Telegram message. Check bot settings.");
      }
    } catch (err) {
      console.error("Error dispatching EOD report:", err);
      alert("Network error sending EOD report.");
    } finally {
      setSendingEodReport(false);
    }
  };

  // ─── Worker Salary Handlers (Mohd Amin) ───
  const handleAddSalaryPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(salaryFormAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid salary amount greater than ₹0.");
      return;
    }

    setSavingSalary(true);
    try {
      const res = await adminFetch("/api/vending-log/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_name: salaryConfig.worker_name || "Mohd Amin",
          salary_month: salaryFormMonth,
          payment_date: salaryFormDate,
          payment_time: salaryFormTime,
          amount,
          payment_mode: salaryFormMode,
          notes: salaryFormNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.payment) {
          setSalaryPayments((prev) => [data.payment, ...prev]);
          setSalaryFormAmount("");
          setSalaryFormNotes("");
          playLogChime();
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to record salary payment.");
      }
    } catch (err) {
      console.error("Error saving salary payment:", err);
      alert("Failed to record salary payment. Please try again.");
    } finally {
      setSavingSalary(false);
    }
  };

  const handleDeleteSalaryPayment = async (id: string) => {
    try {
      const res = await adminFetch(`/api/vending-log/salary?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSalaryPayments((prev) => prev.filter((p) => p.id !== id));
        setDeleteSalaryConfirmId(null);
      }
    } catch (err) {
      console.error("Failed to delete salary payment:", err);
    }
  };

  const handleUpdateBaseSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    const newBase = parseFloat(baseSalaryInput);
    if (isNaN(newBase) || newBase < 0) {
      alert("Please enter a valid base monthly salary.");
      return;
    }

    try {
      const res = await adminFetch("/api/vending-log/salary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_monthly_salary: newBase,
          worker_name: salaryConfig.worker_name || "Mohd Amin",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setSalaryConfig(data.config);
          setEditingBaseSalary(false);
        }
      }
    } catch (err) {
      console.error("Error updating base salary:", err);
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

  // ─── Export Multi-Sheet Excel (.xlsx) ───
  // Contains: Sales Dispatches, Aquarium Stock Log, Mohd Amin Incentives, Mohd Amin Salary, Summary KPIs
  const handleExportExcel = () => {
    try {
      // 1. Executive Summary Sheet
      const summaryRows = [
        { "Vending Center Metric": "Report Generated Date", "Value / Amount": getTodayDate() },
        { "Vending Center Metric": "Active Filter Period", "Value / Amount": period.toUpperCase() },
        { "Vending Center Metric": "Total Vending Revenue (Rs)", "Value / Amount": kpis.totalRevenue },
        { "Vending Center Metric": "Realized Net Profit on Sold Fish (Rs)", "Value / Amount": kpis.totalSoldProfit },
        { "Vending Center Metric": "Gutted Trout Sold Profit (Rs)", "Value / Amount": kpis.guttedProfit },
        { "Vending Center Metric": "Non-Gutted Trout Sold Profit (Rs)", "Value / Amount": kpis.nonGuttedProfit },
        { "Vending Center Metric": "Net Profit Margin on Sold Fish (%)", "Value / Amount": `${kpis.profitMarginPercent}%` },
        { "Vending Center Metric": "Avg Procurement Cost per Kg (Rs)", "Value / Amount": procurementAvgCost },
        { "Vending Center Metric": "Total Weight Sold (Kg)", "Value / Amount": Number(kpis.totalKg.toFixed(3)) },
        { "Vending Center Metric": "Gutted Trout Sold (Kg)", "Value / Amount": Number(kpis.guttedKg.toFixed(3)) },
        { "Vending Center Metric": "Non-Gutted Trout Sold (Kg)", "Value / Amount": Number(kpis.nonGuttedKg.toFixed(3)) },
        { "Vending Center Metric": "Online Payments (Rs)", "Value / Amount": kpis.onlineRevenue },
        { "Vending Center Metric": "Cash Drawer Payments (Rs)", "Value / Amount": kpis.cashRevenue },
        { "Vending Center Metric": "Negotiation Discount Loss (Rs)", "Value / Amount": kpis.totalLoss },
        { "Vending Center Metric": "Total Live Fish Stock Procured (Kg)", "Value / Amount": Number(aquariumStock.totalProcuredKg.toFixed(3)) },
        { "Vending Center Metric": "Live Fish Dispatched / Sold (Kg)", "Value / Amount": Number(aquariumStock.soldKg.toFixed(3)) },
        { "Vending Center Metric": "Current Live Stock in Aquarium (Kg)", "Value / Amount": Number(aquariumStock.remainingKg.toFixed(3)) },
        { "Vending Center Metric": "Total Aquarium Mortality (Kg)", "Value / Amount": Number(aquariumStock.totalMortalityKg.toFixed(3)) },
        { "Vending Center Metric": "Total Mortality Fish Count", "Value / Amount": aquariumStock.totalMortalityCount },
        { "Vending Center Metric": "Total Mortality Financial Loss (Rs)", "Value / Amount": aquariumStock.totalMortalityCost },
        { "Vending Center Metric": "Aquarium Mortality Rate (%)", "Value / Amount": `${aquariumStock.mortalityRatePercent}%` },
        { "Vending Center Metric": "Aquarium Stock Worth - If Gutted (Rs)", "Value / Amount": aquariumStock.valueIfGutted },
        { "Vending Center Metric": "Aquarium Stock Worth - If Non-Gutted (Rs)", "Value / Amount": aquariumStock.valueIfNonGutted },
        { "Vending Center Metric": "Expected Profit from Live Stock - Gutted (Rs)", "Value / Amount": aquariumStock.expectedProfitGutted },
        { "Vending Center Metric": "Expected Profit from Live Stock - Non-Gutted (Rs)", "Value / Amount": aquariumStock.expectedProfitNonGutted },
        { "Vending Center Metric": "Mohd Amin - All-Time Incentives Earned (Rs)", "Value / Amount": incentiveStats.allTimeEarned },
        { "Vending Center Metric": "Mohd Amin - Incentives Paid Out (Rs)", "Value / Amount": incentiveStats.totalPaid },
        { "Vending Center Metric": "Mohd Amin - Incentives Balance Due (Rs)", "Value / Amount": incentiveStats.balanceRemaining },
        { "Vending Center Metric": "Mohd Amin - Base Monthly Salary (Rs)", "Value / Amount": salaryStats.baseMonthly },
        { "Vending Center Metric": "Mohd Amin - Salary Paid This Month (Rs)", "Value / Amount": salaryStats.thisMonthPaid },
        { "Vending Center Metric": "Mohd Amin - All-Time Salary Paid (Rs)", "Value / Amount": salaryStats.allTimePaid },
      ];

      // 2. Sales Dispatches Sheet
      const activeCustomCols = customColumns.filter((c) => c.visible);
      const salesRows = entries.map((e, idx) => {
        const exp =
          e.expected_amount !== undefined && e.expected_amount !== null
            ? Number(e.expected_amount)
            : Math.round(Number(e.weight_kg) * Number(e.rate_per_kg));
        const taken = Number(e.amount_paid) || 0;
        const loss =
          e.discount_amount !== undefined && e.discount_amount !== null
            ? Number(e.discount_amount)
            : Math.max(0, exp - taken);

        const row: Record<string, any> = {
          "#": idx + 1,
          "Date": e.entry_date,
          "Time": e.entry_time,
          "Product Type": e.product_type,
          "Weight (Kg)": Number(Number(e.weight_kg).toFixed(3)),
          "Rate (Rs/Kg)": Number(e.rate_per_kg),
          "Expected Amount (Rs)": exp,
          "Amount Received (Rs)": taken,
          "Negotiation Loss (Rs)": loss,
          "Payment Mode": e.payment_mode,
          "Notes": e.notes || "",
          "Logged By": e.logged_by || "Counter Staff",
        };

        activeCustomCols.forEach((col) => {
          row[col.name] = e.custom_fields?.[col.id] ?? "";
        });

        return row;
      });

      // 3. Aquarium Stock Log Sheet
      const stockRows = stockEntries.map((s, idx) => {
        const totalCost = Number(s.total_cost) || Number(s.weight_kg) * Number(s.cost_per_kg);
        return {
          "#": idx + 1,
          "Procurement Date": s.stock_date,
          "Time": s.stock_time,
          "Supplier Name": s.supplier_name,
          "Stock Type": s.product_type,
          "Weight (Kg)": Number(Number(s.weight_kg).toFixed(3)),
          "Cost / Kg (Rs)": Number(s.cost_per_kg),
          "Total Cost (Rs)": Math.round(totalCost),
          "Batch Notes": s.batch_notes || "",
          "Logged By": s.logged_by || "Admin",
        };
      });

      // 4. Mohd Amin - Incentives Sheet
      const incentiveRows = payouts.map((p, idx) => ({
        "#": idx + 1,
        "Payout Date": p.payout_date,
        "Time": p.payout_time || "",
        "Worker Name": p.recipient_name || "Mohd Amin",
        "Incentive Amount (Rs)": Number(p.amount),
        "Payment Mode": p.payment_mode,
        "Notes": p.notes || "",
        "Created At": p.created_at,
      }));

      // 5. Mohd Amin - Salary Sheet
      const salaryRows = salaryPayments.map((p, idx) => ({
        "#": idx + 1,
        "Payment Date": p.payment_date,
        "Time": p.payment_time || "",
        "Worker Name": p.worker_name || "Mohd Amin",
        "Salary Month": p.salary_month,
        "Salary Amount (Rs)": Number(p.amount),
        "Payment Mode": p.payment_mode,
        "Notes": p.notes || "",
        "Created At": p.created_at,
      }));

      // Build Multi-Sheet Workbook
      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Overview Summary");

      const wsSales = XLSX.utils.json_to_sheet(salesRows.length > 0 ? salesRows : [{ "Status": "No sales records logged yet" }]);
      XLSX.utils.book_append_sheet(wb, wsSales, "Sales Dispatches");

      const wsStock = XLSX.utils.json_to_sheet(stockRows.length > 0 ? stockRows : [{ "Status": "No stock procurement logged yet" }]);
      XLSX.utils.book_append_sheet(wb, wsStock, "Aquarium Stock Log");

      const wsIncentives = XLSX.utils.json_to_sheet(incentiveRows.length > 0 ? incentiveRows : [{ "Status": "No worker incentives logged yet" }]);
      XLSX.utils.book_append_sheet(wb, wsIncentives, "Mohd Amin - Incentives");

      const wsSalary = XLSX.utils.json_to_sheet(salaryRows.length > 0 ? salaryRows : [{ "Status": "No salary payments logged yet" }]);
      XLSX.utils.book_append_sheet(wb, wsSalary, "Mohd Amin - Salary");

      // 6. Aquarium Mortality & Scrap Sheet
      const mortalityRows = mortalityEntries.map((m, idx) => ({
        "#": idx + 1,
        "Date": m.mortality_date,
        "Time": m.mortality_time,
        "Weight (Kg)": Number(Number(m.weight_kg).toFixed(3)),
        "Fish Count": m.fish_count || 1,
        "Reason / Cause": m.reason,
        "Financial Loss (Rs)": Math.round(Number(m.weight_kg) * procurementAvgCost),
        "Logged By": m.logged_by || "Admin",
        "Notes": m.notes || "",
        "Logged At": m.created_at,
      }));
      const wsMortality = XLSX.utils.json_to_sheet(
        mortalityRows.length > 0 ? mortalityRows : [{ "Status": "Zero fish mortality logged" }]
      );
      XLSX.utils.book_append_sheet(wb, wsMortality, "Mortality & Scrap Log");

      XLSX.writeFile(wb, `UrbanTrout_Complete_Vending_Ledger_${getTodayDate()}.xlsx`);
    } catch (err) {
      console.error("Error generating Excel file:", err);
      alert("Failed to export Excel file. Please try again.");
    }
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

    const cf = entry.custom_fields || {};
    setFormCustomerName(cf.customer_name || "");
    setFormCustomerPhone(cf.customer_phone || "");
    const balAmt = Number(cf.balance_amount || 0);
    if (balAmt > 0 && cf.balance_status === "pending") {
      setFormBalanceAction("balance");
    } else if (cf.balance_status === "waived_final") {
      setFormBalanceAction("final_settlement");
    } else if (cf.balance_status === "none") {
      setFormBalanceAction("none");
    } else {
      const w = Number(entry.weight_kg) || 0;
      const rate = Number(entry.rate_per_kg) || 0;
      const exp = Number(entry.expected_amount) || Math.round(w * rate);
      const paid = Number(entry.amount_paid) || 0;
      setFormBalanceAction(exp > paid ? "final_settlement" : "none");
    }

    setNewEntryModalOpen(true);
  };

  // Open Balance Reminder Modal from sales table row
  const handleOpenBalanceModalForEntry = (entry: VendingSalesEntry) => {
    const cf = entry.custom_fields || {};
    const refId = cf.balance_ref_id || `VL-${entry.entry_date.replace(/\D/g, "")}-${entry.id.slice(-4)}`;
    const balAmt = Number(cf.balance_amount) || Math.max(0, Number(entry.expected_amount) - Number(entry.amount_paid));
    const rec: CustomerBalanceRecord = {
      id: refId,
      invoice_id: refId,
      customer_name: cf.customer_name || "Counter Customer",
      customer_phone: cf.customer_phone || "",
      total_amount: Number(entry.expected_amount || Math.round(Number(entry.weight_kg) * Number(entry.rate_per_kg))),
      paid_amount: Number(entry.amount_paid),
      balance_amount: balAmt,
      status: "pending",
      payment_method: entry.payment_mode || "Cash",
      settlement_note: `Vending Center Sale: ${entry.weight_kg} Kg ${entry.product_type}`,
      items_summary: `${entry.weight_kg} Kg ${entry.product_type} Trout`,
      created_at: `${entry.entry_date}T${entry.entry_time || "12:00:00"}`,
      updated_at: new Date().toISOString(),
    };
    setSelectedBalanceRecord(rec);
    setBalanceModalOpen(true);
  };

  // Called when balance is settled or repaid via BalanceReminderModal
  const handleBalanceUpdated = async () => {
    if (selectedBalanceRecord) {
      const refId = selectedBalanceRecord.invoice_id || selectedBalanceRecord.id;
      setEntries((prev) =>
        prev.map((item) => {
          if (item.custom_fields?.balance_ref_id === refId) {
            const updatedCf = {
              ...item.custom_fields,
              balance_status: "settled",
              balance_amount: 0,
            };
            adminFetch("/api/vending-log", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: item.id,
                updates: { custom_fields: updatedCf },
              }),
            }).catch((err) => console.warn("Could not sync settled vending entry:", err));

            return {
              ...item,
              custom_fields: updatedCf,
            };
          }
          return item;
        })
      );
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-20">
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

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenEodModal}
              className="py-2.5 px-3.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Preview and dispatch End-of-Day (EOD) sales & aquarium audit to Telegram"
            >
              <span className="material-symbols-outlined text-sm">send</span>
              <span>EOD Report</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="py-2.5 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Export complete multi-sheet Excel file (Sales, Stock, Mohd Amin Incentives & Salary, Summary)"
          >
            <span className="material-symbols-outlined text-sm">table_chart</span>
            Export Excel
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              {[
                { id: "today", label: "Today" },
                { id: "week", label: "This Week" },
                { id: "month", label: "This Month" },
                { id: "all", label: "All Time" },
                { id: "custom", label: "Custom Range" },
              ].map((tab) => {
                const isSel = period === tab.id;
                const tabLabel =
                  tab.id === "today"
                    ? `Today · ${formatIstDateDisplay(getTodayDate())}`
                    : tab.label;
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
                    {tabLabel}
                  </button>
                );
              })}
            </div>

            {/* Live IST Status indicator */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-[11px] font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-semibold">IST</span>
              <span>·</span>
              <span className="text-slate-300">{serverDateFormatted || formatIstDateDisplay(getTodayDate())}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            {/* Admin Financial Cards Visibility Toggle (Hidden for Staff) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdminCards((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                title={showAdminCards ? "Hide financial metric cards" : "Show financial metric cards"}
              >
                <span className="material-symbols-outlined text-sm">
                  {showAdminCards ? "visibility" : "visibility_off"}
                </span>
                <span className="hidden sm:inline">
                  {showAdminCards ? "Admin Cards: Visible" : "Admin Cards: Hidden"}
                </span>
                <span className="sm:hidden">
                  {showAdminCards ? "Visible" : "Hidden"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            SECTION 1: SALES & REVENUE PERFORMANCE (6 Spacious Cards)
            ══════════════════════════════════════════════════════════ */}
        {isAdmin && showAdminCards && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
              {/* Card 1: Total Weight Sold */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900 border border-emerald-500/30 shadow-xl shadow-emerald-950/20 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                    <span className="font-bold tracking-wider">TOTAL KG SOLD</span>
                    <span className="material-symbols-outlined text-emerald-400 text-lg">scale</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2 min-h-[36px]">
                    {loading && entries.length === 0 ? (
                      <div className="h-8 w-28 bg-emerald-500/10 rounded animate-pulse" />
                    ) : (
                      <>
                        <span
                          className="text-3xl sm:text-4xl font-black text-white"
                          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                        >
                          {formatKg(kpis.totalKg)}
                        </span>
                        <span className="text-emerald-400 font-bold font-mono text-sm">Kg</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3.5 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-bold">Gutted: {formatKg(kpis.guttedKg)} Kg</span>
                    <span className="text-cyan-300">Non: {formatKg(kpis.nonGuttedKg)} Kg</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{kpis.count} total dispatches</div>
                </div>
              </div>

              {/* Card 2: Total Revenue Collected */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-slate-900 border border-cyan-500/30 shadow-xl shadow-cyan-950/20 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                    <span className="font-bold tracking-wider">REVENUE</span>
                    <span className="material-symbols-outlined text-cyan-400 text-lg">payments</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1 min-h-[36px]">
                    {loading && entries.length === 0 ? (
                      <div className="h-8 w-28 bg-cyan-500/10 rounded animate-pulse" />
                    ) : (
                      <>
                        <span className="text-cyan-400 font-bold text-xl">₹</span>
                        <span
                          className="text-3xl sm:text-4xl font-black text-white"
                          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                        >
                          {kpis.totalRevenue.toLocaleString("en-IN")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3.5 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span>Expected: ₹{kpis.totalExpected.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {kpis.count} bills • Avg ₹{kpis.avgBillValue}/bill
                  </div>
                </div>
              </div>

              {/* Card 3: Realized Profit on Sold Trout (NEW) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-teal-950/50 via-slate-900/90 to-slate-900 border border-teal-500/40 shadow-xl shadow-teal-950/25 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                    <span className="text-teal-300 font-bold tracking-wider flex items-center gap-1.5">
                      <span>PROFIT ON SOLD</span>
                      <span className="px-1.5 py-0.2 rounded bg-teal-500/20 text-[9px] text-teal-200 border border-teal-500/30 font-bold">
                        Net
                      </span>
                    </span>
                    <span className="material-symbols-outlined text-teal-400 text-lg">trending_up</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1 min-h-[36px]">
                    {loading && entries.length === 0 ? (
                      <div className="h-8 w-28 bg-teal-500/10 rounded animate-pulse" />
                    ) : (
                      <>
                        <span className="text-teal-400 font-bold text-xl">₹</span>
                        <span
                          className="text-3xl sm:text-4xl font-black text-white"
                          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                        >
                          {kpis.totalSoldProfit.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[11px] font-bold text-teal-400 font-mono ml-1">
                          {kpis.profitMarginPercent}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3.5 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-bold">G: ₹{kpis.guttedProfit.toLocaleString("en-IN")}</span>
                    <span className="text-cyan-300 font-bold">NG: ₹{kpis.nonGuttedProfit.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    At ₹{kpis.procurementAvgCost}/Kg procurement cost
                  </div>
                </div>
              </div>

              {/* Card 4: Online Payments */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900 border border-indigo-500/30 shadow-xl shadow-indigo-950/20 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                    <span className="font-bold tracking-wider">ONLINE</span>
                    <span className="material-symbols-outlined text-indigo-400 text-lg">contactless</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1 min-h-[36px]">
                    {loading && entries.length === 0 ? (
                      <div className="h-8 w-28 bg-indigo-500/10 rounded animate-pulse" />
                    ) : (
                      <>
                        <span className="text-indigo-400 font-bold text-xl">₹</span>
                        <span
                          className="text-3xl sm:text-4xl font-black text-white"
                          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                        >
                          {kpis.onlineRevenue.toLocaleString("en-IN")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3.5 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2.5 space-y-0.5">
                  <div className="flex items-center justify-between text-indigo-300">
                    <span>{kpis.onlineCount} orders</span>
                    <span>{formatKg(kpis.onlineKg)} Kg</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">J&amp;K Soundbox, UPI &amp; Cards</div>
                </div>
              </div>

              {/* Card 5: Cash Payments */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900/80 to-slate-900 border border-blue-500/30 shadow-xl shadow-blue-950/20 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                    <span className="font-bold tracking-wider">CASH DRAWER</span>
                    <span className="material-symbols-outlined text-blue-400 text-lg">point_of_sale</span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1 min-h-[36px]">
                    {loading && entries.length === 0 ? (
                      <div className="h-8 w-28 bg-blue-500/10 rounded animate-pulse" />
                    ) : (
                      <>
                        <span className="text-blue-400 font-bold text-xl">₹</span>
                        <span
                          className="text-3xl sm:text-4xl font-black text-white"
                          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                        >
                          {kpis.cashRevenue.toLocaleString("en-IN")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3.5 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2.5 space-y-0.5">
                  <div className="flex items-center justify-between text-blue-300">
                    <span>{kpis.cashCount} sales</span>
                    <span>{formatKg(kpis.cashKg)} Kg</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">Counter Cash Drawer</div>
                </div>
              </div>

              {/* Card 6: Negotiation Concession / Loss */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border shadow-xl relative overflow-hidden flex flex-col justify-between ${
                  kpis.totalLoss > 0
                    ? "bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-slate-900 border-amber-500/40 shadow-amber-950/20"
                    : "bg-gradient-to-br from-emerald-950/30 via-slate-900/80 to-slate-900 border-emerald-500/30 shadow-emerald-950/10"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                    <span className={kpis.totalLoss > 0 ? "text-amber-300 font-bold tracking-wider" : "tracking-wider"}>
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
                  <div className="mt-2.5 flex items-baseline gap-1 min-h-[36px]">
                    {loading && entries.length === 0 ? (
                      <div className="h-8 w-24 bg-amber-500/10 rounded animate-pulse" />
                    ) : kpis.totalLoss > 0 ? (
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
                <div className="mt-3.5 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2.5 space-y-0.5">
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
                      ? "Lost to customer bargaining"
                      : "All orders at full inventory price"}
                  </div>
                  {kpis.pendingBalanceTotal > 0 && (
                    <div className="mt-1 flex items-center justify-between text-[10px] text-amber-300 font-mono bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                      <span>⏳ Khata Due:</span>
                      <span className="font-bold">₹{kpis.pendingBalanceTotal.toLocaleString("en-IN")} ({kpis.pendingBalanceCount})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECTION 2: WORKER COMPENSATION & SALARY MANAGEMENT (Mohd Amin)
                ══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Card A: Mohd Amin Gutted Incentive */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-950/50 via-slate-900/90 to-slate-900 border border-purple-500/40 shadow-xl shadow-purple-950/20 relative overflow-hidden flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                    <span className="text-purple-300 font-bold flex items-center gap-2 tracking-wider">
                      <span className="material-symbols-outlined text-purple-400 text-base">volunteer_activism</span>
                      <span>MOHD AMIN · GUTTED INCENTIVE</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-[10px] text-purple-200 border border-purple-500/30">
                        ₹5.00 / Kg
                      </span>
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        incentiveStats.balanceRemaining > 0
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {incentiveStats.balanceRemaining > 0 ? "Pending Due" : "Settled ✓"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 min-h-[36px]">
                    {loading && entries.length === 0 ? (
                      <div className="h-8 w-28 bg-purple-500/10 rounded animate-pulse" />
                    ) : (
                      <>
                        <span className="text-purple-400 font-bold text-xl">₹</span>
                        <span
                          className="text-3xl sm:text-4xl font-black text-white"
                          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                        >
                          {incentiveStats.balanceRemaining.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-slate-400 font-mono ml-1">pending disbursement</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4 text-xs text-slate-400 font-mono border-t border-slate-800/80 pt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-purple-200 text-[11px]">
                    <span>Earned: <strong>₹{incentiveStats.allTimeEarned.toLocaleString("en-IN")}</strong></span>
                    <span>•</span>
                    <span>Paid: <strong>₹{incentiveStats.totalPaid.toLocaleString("en-IN")}</strong></span>
                    <span>•</span>
                    <span>Gutted: <strong>{formatKg(incentiveStats.allTimeGuttedKg)} Kg</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayoutModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 text-xs font-bold font-mono transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    <span>Pay Incentive</span>
                  </button>
                </div>
              </div>

              {/* Card B: Mohd Amin Monthly Salary Management */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-sky-950/50 via-slate-900/90 to-slate-900 border border-sky-500/40 shadow-xl shadow-sky-950/20 relative overflow-hidden flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                    <span className="text-sky-300 font-bold flex items-center gap-2 tracking-wider">
                      <span className="material-symbols-outlined text-sky-400 text-base">badge</span>
                      <span>MOHD AMIN · MONTHLY SALARY</span>
                      <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-[10px] text-sky-200 border border-sky-500/30">
                        Wage
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingBaseSalaryCard((p) => !p)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-[10px] font-bold font-mono transition-all cursor-pointer"
                      title="Edit Mohd Amin's base monthly wage"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span>
                      <span>{editingBaseSalaryCard ? "Close" : "Edit Salary"}</span>
                    </button>
                  </div>

                  {editingBaseSalaryCard ? (
                    <form
                      onSubmit={(e) => {
                        handleUpdateBaseSalary(e);
                        setEditingBaseSalaryCard(false);
                      }}
                      className="mt-3 p-3 rounded-xl bg-slate-950 border border-sky-500/50 flex items-center gap-2.5 animate-in fade-in"
                    >
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                          Base Monthly Wage for Mohd Amin (₹)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1 text-sky-400 font-bold text-xs font-mono">₹</span>
                          <input
                            type="number"
                            value={baseSalaryInput}
                            onChange={(e) => setBaseSalaryInput(e.target.value)}
                            className="w-full pl-6 pr-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold font-mono focus:outline-none focus:border-sky-400"
                            placeholder="15000"
                            autoFocus
                            required
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-1.5 mt-3.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold font-mono transition-all cursor-pointer shadow"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBaseSalaryCard(false)}
                        className="px-2.5 py-1.5 mt-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="mt-3 flex items-baseline gap-1.5 min-h-[36px]">
                      {loading && entries.length === 0 ? (
                        <div className="h-8 w-28 bg-sky-500/10 rounded animate-pulse" />
                      ) : (
                        <>
                          <span className="text-sky-400 font-bold text-xl">₹</span>
                          <span
                            className="text-3xl sm:text-4xl font-black text-white"
                            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                          >
                            {salaryStats.thisMonthPaid.toLocaleString("en-IN")}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ml-1 ${
                              salaryStats.monthBalanceDue > 0
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {salaryStats.monthBalanceDue > 0
                              ? `₹${salaryStats.monthBalanceDue.toLocaleString("en-IN")} Due`
                              : "Paid ✓"}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 text-xs text-slate-400 font-mono border-t border-slate-800/80 pt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-sky-200 text-[11px]">
                    <span>Base: <strong className="text-white">₹{salaryStats.baseMonthly.toLocaleString("en-IN")}</strong>/mo</span>
                    <span>•</span>
                    <span>{salaryStats.currentMonthLabel}</span>
                    <span>•</span>
                    <span>All-time: <strong>₹{salaryStats.allTimePaid.toLocaleString("en-IN")}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSalaryModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-bold font-mono transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                    <span>Pay Salary</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>

      {/* ══════════════════════════════════════════════════════════
          AQUARIUM BIOMASS STOCK TRACKER — Flash Cards + Log
          Visible to Admin only. Shows live stock remaining in aquarium.
          ══════════════════════════════════════════════════════════ */}
      {isAdmin && (
        <div className="space-y-3">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-base">set_meal</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-blue-300 font-mono">
                Aquarium Live Stock
              </span>
              {!stockTableAvailable && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold">
                  Run SQL to enable
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStockLogOpen((p) => !p)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 text-[11px] font-mono font-bold transition-all cursor-pointer"
                title="Toggle procurement log"
              >
                <span className="material-symbols-outlined text-xs">
                  {stockLogOpen ? "expand_less" : "expand_more"}
                </span>
                {stockLogOpen ? "Hide" : "Show"} Stock ({stockEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setShowMortalityTable((p) => !p)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-rose-300 border border-rose-500/30 text-[11px] font-mono font-bold transition-all cursor-pointer"
                title="Toggle mortality & scrap loss table"
              >
                <span className="material-symbols-outlined text-xs">
                  {showMortalityTable ? "expand_less" : "expand_more"}
                </span>
                {showMortalityTable ? "Hide" : "Show"} Mortality ({mortalityEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setStockModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Log Stock
              </button>
              <button
                type="button"
                onClick={() => setMortalityModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-500/20 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">emergency</span>
                Log Mortality
              </button>
            </div>
          </div>

          {/* Flash Cards Row — 6 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">

            {/* Card 1: Live Stock Remaining in Aquarium */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/50 via-slate-900/90 to-slate-900 border border-blue-500/40 shadow-xl shadow-blue-950/20 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span className="text-blue-300 font-bold">LIVE IN AQUARIUM</span>
                  <span className="material-symbols-outlined text-blue-400 text-lg">water</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className="text-3xl sm:text-4xl font-black text-white"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  >
                    {formatKg(aquariumStock.remainingKg)}
                  </span>
                  <span className="text-blue-400 font-bold font-mono text-sm">Kg</span>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Procured:</span>
                  <span className="text-blue-200 font-bold">{formatKg(aquariumStock.totalProcuredKg)} Kg</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-rose-400">Mortality: -{formatKg(aquariumStock.totalMortalityKg)} Kg</span>
                  <span className="text-slate-500">₹{aquariumStock.avgCostPerKg}/Kg</span>
                </div>
              </div>
            </div>

            {/* Card 2: Gone from Aquarium (Sold) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-900/80 to-slate-900 border border-rose-500/30 shadow-xl shadow-rose-950/20 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span className="text-rose-300 font-bold">GONE · SOLD OUT</span>
                  <span className="material-symbols-outlined text-rose-400 text-lg">output</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className="text-3xl sm:text-4xl font-black text-white"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  >
                    {formatKg(aquariumStock.soldKg)}
                  </span>
                  <span className="text-rose-400 font-bold font-mono text-sm">Kg</span>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-rose-300/80">Dispatched all-time</span>
                  <span className="text-rose-200 font-bold">
                    {aquariumStock.totalProcuredKg > 0
                      ? `${((aquariumStock.soldKg / aquariumStock.totalProcuredKg) * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">of total procured stock</div>
              </div>
            </div>

            {/* Card 3: Value if Sold as Gutted */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900 border border-emerald-500/30 shadow-xl shadow-emerald-950/20 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span className="text-emerald-300 font-bold">VALUE · IF GUTTED</span>
                  <span className="material-symbols-outlined text-emerald-400 text-lg">set_meal</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-emerald-400 font-bold text-xl">₹</span>
                  <span
                    className="text-3xl sm:text-4xl font-black text-white"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  >
                    {aquariumStock.valueIfGutted.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span>{formatKg(aquariumStock.remainingKg)} Kg remaining</span>
                  <span className="text-emerald-300">@ ₹{guttedPrice}/Kg</span>
                </div>
                <div className="text-[10px] text-slate-500">At current Gutted sell rate</div>
              </div>
            </div>

            {/* Card 4: Value if Sold as Non-Gutted */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-slate-900 border border-cyan-500/30 shadow-xl shadow-cyan-950/20 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span className="text-cyan-300 font-bold">VALUE · IF NON-GUTTED</span>
                  <span className="material-symbols-outlined text-cyan-400 text-lg">phishing</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-cyan-400 font-bold text-xl">₹</span>
                  <span
                    className="text-3xl sm:text-4xl font-black text-white"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  >
                    {aquariumStock.valueIfNonGutted.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span>{formatKg(aquariumStock.remainingKg)} Kg remaining</span>
                  <span className="text-cyan-300">@ ₹{nonGuttedPrice}/Kg</span>
                </div>
                <div className="text-[10px] text-slate-500">At current Non-Gutted sell rate</div>
              </div>
            </div>

            {/* Card 5: Expected Profit (Gutted & Non-Gutted) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-slate-900 border border-amber-500/40 shadow-xl shadow-amber-950/20 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span className="text-amber-300 font-bold">EXPECTED PROFIT</span>
                  <span className="material-symbols-outlined text-amber-400 text-lg">trending_up</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-amber-400 font-bold text-xl">₹</span>
                  <span
                    className="text-3xl sm:text-4xl font-black text-white"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  >
                    {aquariumStock.expectedProfitGutted.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-300 font-mono ml-1">Gutted</span>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">If Non-Gutted:</span>
                  <span className="text-cyan-300 font-bold font-mono">
                    ₹{aquariumStock.expectedProfitNonGutted.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Margin: ₹{guttedPrice - aquariumStock.avgCostPerKg}/Kg G · ₹{nonGuttedPrice - aquariumStock.avgCostPerKg}/Kg NG
                </div>
              </div>
            </div>

            {/* Card 6: Mortality & Scrap Wastage (NEW) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/50 via-slate-900/90 to-slate-900 border border-rose-500/40 shadow-xl shadow-rose-950/20 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                  <span className="text-rose-300 font-bold flex items-center gap-1.5">
                    <span>MORTALITY &amp; SCRAP</span>
                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-[9px] text-rose-200 border border-rose-500/30">
                      Loss
                    </span>
                  </span>
                  <span className="material-symbols-outlined text-rose-400 text-lg">emergency</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className="text-3xl sm:text-4xl font-black text-rose-300"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  >
                    {formatKg(aquariumStock.totalMortalityKg)}
                  </span>
                  <span className="text-rose-400 font-bold font-mono text-sm">Kg</span>
                  <span className="text-[10px] font-mono text-slate-400 ml-auto">
                    {aquariumStock.totalMortalityCount} fish
                  </span>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Loss:</span>
                  <span className="text-rose-300 font-bold">
                    ₹{aquariumStock.totalMortalityCost.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Today: {formatKg(aquariumStock.todayMortalityKg)} Kg</span>
                  <span>{aquariumStock.mortalityRatePercent}% loss rate</span>
                </div>
              </div>
            </div>

          </div>

          {/* Procurement Log Table (collapsible) */}
          {stockLogOpen && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden animate-in fade-in duration-200">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-3 text-center w-8">#</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Time</th>
                      <th className="py-3 px-3">Supplier</th>
                      <th className="py-3 px-3">Stock</th>
                      <th className="py-3 px-3 text-right">Weight (Kg)</th>
                      <th className="py-3 px-3 text-right">Cost/Kg (₹)</th>
                      <th className="py-3 px-3 text-right text-violet-300">Total Cost (₹)</th>
                      <th className="py-3 px-3">Notes</th>
                      <th className="py-3 px-3">Logged By</th>
                      <th className="py-3 px-3 text-center">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {stockEntries.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-slate-500 text-xs">
                          <span className="material-symbols-outlined text-2xl block mb-1 text-slate-600">inventory_2</span>
                          No procurement entries yet. Click &ldquo;Log Stock&rdquo; to add your first batch.
                        </td>
                      </tr>
                    ) : (
                      stockEntries.map((s, idx) => {
                        const totalCost = Number(s.total_cost) || Number(s.weight_kg) * Number(s.cost_per_kg);
                        return (
                          <tr
                            key={s.id}
                            className="hover:bg-slate-800/30 transition-colors group"
                          >
                            <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 text-slate-300">{s.stock_date}</td>
                            <td className="py-2.5 px-3 text-slate-400">{s.stock_time}</td>
                            <td className="py-2.5 px-3 text-blue-300 font-semibold">{s.supplier_name}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1 w-fit">
                                <span className="material-symbols-outlined text-[11px]">water</span>
                                Live Fish
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-white font-bold">{formatKg(s.weight_kg)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-300">₹{Number(s.cost_per_kg).toLocaleString("en-IN")}</td>
                            <td className="py-2.5 px-3 text-right text-violet-300 font-bold">
                              ₹{Math.round(totalCost).toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 max-w-[120px] truncate">{s.batch_notes || "—"}</td>
                            <td className="py-2.5 px-3 text-slate-500">{s.logged_by || "—"}</td>
                            <td className="py-2.5 px-3 text-center">
                              {deleteStockConfirmId === s.id ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStockEntry(s.id)}
                                    className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteStockConfirmId(null)}
                                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteStockConfirmId(s.id)}
                                  className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-red-400 transition-all cursor-pointer"
                                  title="Delete this stock entry"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mortality & Scrap Wastage Table (collapsible) */}
          {showMortalityTable && (
            <div className="bg-slate-900/60 border border-rose-500/30 rounded-2xl overflow-hidden animate-in fade-in duration-200">
              <div className="px-4 py-3 bg-rose-950/20 border-b border-rose-500/20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400 text-sm">emergency</span>
                  <span className="text-xs font-bold font-mono text-rose-300 uppercase tracking-wider">
                    Aquarium Mortality &amp; Scrap Wastage Log ({mortalityEntries.length} entries)
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Total Dead: <strong className="text-rose-300">{formatKg(aquariumStock.totalMortalityKg)} Kg</strong> ({aquariumStock.totalMortalityCount} fish) · Loss: <strong className="text-rose-300">₹{aquariumStock.totalMortalityCost.toLocaleString("en-IN")}</strong>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-3 text-center w-8">#</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Time</th>
                      <th className="py-3 px-3">Reason / Cause</th>
                      <th className="py-3 px-3 text-right">Dead Fish</th>
                      <th className="py-3 px-3 text-right text-rose-300">Weight (Kg)</th>
                      <th className="py-3 px-3 text-right text-rose-300">Loss Value (₹)</th>
                      <th className="py-3 px-3">Notes</th>
                      <th className="py-3 px-3">Logged By</th>
                      <th className="py-3 px-3 text-center">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {mortalityEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-slate-500 text-xs">
                          <span className="material-symbols-outlined text-2xl block mb-1 text-slate-600">verified</span>
                          Zero aquarium mortality logged! Live fish stock is 100% healthy.
                        </td>
                      </tr>
                    ) : (
                      mortalityEntries.map((m, idx) => {
                        const lossValue = Math.round(Number(m.weight_kg) * procurementAvgCost);
                        return (
                          <tr key={m.id} className="hover:bg-slate-800/40 transition-colors group">
                            <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">{m.mortality_date}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">{m.mortality_time || "—"}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                {m.reason}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">
                              {m.fish_count || 1}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-rose-400">
                              {formatKg(m.weight_kg)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-rose-300">
                              ₹{lossValue.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 max-w-[130px] truncate">{m.notes || "—"}</td>
                            <td className="py-2.5 px-3 text-slate-500">{m.logged_by || "—"}</td>
                            <td className="py-2.5 px-3 text-center">
                              {deleteMortalityConfirmId === m.id ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMortalityEntry(m.id)}
                                    className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteMortalityConfirmId(null)}
                                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteMortalityConfirmId(m.id)}
                                  className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-red-400 transition-all cursor-pointer"
                                  title="Delete this mortality entry"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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
                        {Number(e.custom_fields?.balance_amount) > 0 && e.custom_fields?.balance_status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => handleOpenBalanceModalForEntry(e)}
                            className="inline-flex flex-col items-end gap-0.5 text-right group/bal cursor-pointer"
                            title="Click to open Razorpay QR & WhatsApp Reminder"
                          >
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 group-hover/bal:bg-amber-500/30 transition-all">
                              <span>⏳ Bal: ₹{Number(e.custom_fields.balance_amount).toLocaleString("en-IN")}</span>
                            </span>
                            {e.custom_fields.customer_phone && (
                              <span className="text-[9px] text-amber-400/80 font-mono">
                                {e.custom_fields.customer_name || e.custom_fields.customer_phone}
                              </span>
                            )}
                          </button>
                        ) : e.custom_fields?.balance_status === "waived_final" ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-300 bg-slate-800 border border-slate-700"
                            title={`Settled as final courtesy concession: ₹${loss}`}
                          >
                            <span>🤝 Waived (-₹{loss})</span>
                          </span>
                        ) : loss > 0 ? (
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
                        ) : e.payment_mode === "Razorpay Link" && (e.custom_fields?.payment_status === "PENDING_LINK" || Number(e.amount_paid) === 0) ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold">
                            ⏳ Link Sent
                          </span>
                        ) : e.payment_mode === "Razorpay Link" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold">
                            🔒 Razorpay Paid
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
                          {Number(e.custom_fields?.balance_amount) > 0 && e.custom_fields?.balance_status === "pending" && (
                            <button
                              type="button"
                              onClick={() => handleOpenBalanceModalForEntry(e)}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-mono transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                              title="Send WhatsApp Payment Reminder / Generate Razorpay QR"
                            >
                              <span className="material-symbols-outlined text-xs">qr_code_2</span>
                              <span>Remind</span>
                            </button>
                          )}
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
                    {wNum > 0 && (actualPaid > 0 || formAmount === "0") && (
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
                              ? "Negotiation / Balance Difference:"
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

                    {/* Balance vs Final Settlement Options (When customer paid less than expected) */}
                    {wNum > 0 && (actualPaid > 0 || formAmount === "0") && loss > 0 && (
                      <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-400 text-base">account_balance_wallet</span>
                            <span className="text-xs font-bold text-slate-200 font-mono">
                              Remaining Difference: ₹{loss.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">Treatment</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {/* Option 1: Final Settlement (Waived concession) */}
                          <button
                            type="button"
                            onClick={() => setFormBalanceAction("final_settlement")}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              formBalanceAction === "final_settlement"
                                ? "bg-slate-800/90 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 shadow-md"
                                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <span>🤝 Final Settlement</span>
                            </div>
                            <p className="text-[10px] opacity-75 mt-0.5 leading-snug">
                              Concede ₹{loss} as courtesy discount. No balance pending.
                            </p>
                          </button>

                          {/* Option 2: Keep Balance (Khata) */}
                          <button
                            type="button"
                            onClick={() => setFormBalanceAction("balance")}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              formBalanceAction === "balance"
                                ? "bg-amber-950/40 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 shadow-md shadow-amber-950/30"
                                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <span>📒 Keep Balance (Khata)</span>
                            </div>
                            <p className="text-[10px] opacity-75 mt-0.5 leading-snug">
                              Record ₹{loss} balance. Send QR & WhatsApp reminder later.
                            </p>
                          </button>
                        </div>

                        {/* Customer details when Balance is chosen */}
                        {formBalanceAction === "balance" && (
                          <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2.5">
                            <div className="flex items-center justify-between text-[11px] text-amber-300 font-mono">
                              <span className="font-bold">Customer Contact for Balance Reminder</span>
                              <span className="text-[10px] text-amber-400/80">Phone required for WhatsApp/QR</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                                  Customer Phone (WhatsApp) <span className="text-amber-400">*</span>
                                </label>
                                <input
                                  type="tel"
                                  value={formCustomerPhone}
                                  onChange={(e) => setFormCustomerPhone(e.target.value)}
                                  placeholder="e.g. 9876543210"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                                  Customer Name (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={formCustomerName}
                                  onChange={(e) => setFormCustomerName(e.target.value)}
                                  placeholder="e.g. Dr. Farooq / Tariq Sb"
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-amber-300/80 font-mono">
                              💡 This balance will appear on your Executive Dashboard Flashcard and Khata tab with one-click Razorpay QR & polite WhatsApp reminders.
                            </p>
                          </div>
                        )}

                        {/* Option 3: Remove / Clear Balance (Shown in edit mode or when balance was previously recorded) */}
                        {(editingEntry?.custom_fields?.balance_amount || formBalanceAction === "none") && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                            <span className="text-[10px] text-slate-400 font-mono">Need to remove tracking?</span>
                            <button
                              type="button"
                              onClick={() => setFormBalanceAction("none")}
                              className={`text-[10px] font-mono px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                formBalanceAction === "none"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold"
                                  : "text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                              }`}
                            >
                              ✕ Remove / Clear Balance Record
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notice if editing an entry that had a balance but is now fully paid */}
                    {editingEntry?.custom_fields?.balance_amount && loss <= 0 && (
                      <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Full amount paid! Previous balance record will be marked settled.</span>
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

      {/* ══════════════════════════════════════════════════════════
          MODAL 3: STAFF INCENTIVE PAYOUTS & DISBURSEMENT LEDGER
          ══════════════════════════════════════════════════════════ */}
      {isAdmin && payoutModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPayoutModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-5 sm:p-7 max-w-2xl w-full text-slate-200 shadow-2xl space-y-5 my-4 max-h-[92vh] overflow-y-auto font-mono">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-400 text-xl">volunteer_activism</span>
                  <h3 className="text-base sm:text-lg font-black text-white font-['Space_Grotesk']">
                    Staff Gutted Trout Incentive Tracker
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                    ₹5.00 / Kg
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Automated incentive calculation for gutted trout sales &amp; payout disbursement ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayoutModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Top Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Gutted Sold (All-Time)
                </span>
                <div className="mt-1 text-base sm:text-lg font-black text-white">
                  {formatKg(incentiveStats.allTimeGuttedKg)}{" "}
                  <span className="text-xs text-purple-400 font-normal">Kg</span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Period: {formatKg(incentiveStats.periodGuttedKg)} Kg
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-purple-500/20">
                <span className="text-[10px] text-purple-300 uppercase tracking-wider block">
                  Incentive Accrued
                </span>
                <div className="mt-1 text-base sm:text-lg font-black text-purple-300">
                  ₹{incentiveStats.allTimeEarned.toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Period: ₹{incentiveStats.periodEarned.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Total Paid Out
                </span>
                <div className="mt-1 text-base sm:text-lg font-black text-cyan-300">
                  ₹{incentiveStats.totalPaid.toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {payouts.length} disbursements
                </span>
              </div>

              <div
                className={`p-3 rounded-2xl border ${
                  incentiveStats.balanceRemaining > 0
                    ? "bg-amber-950/20 border-amber-500/40"
                    : "bg-emerald-950/20 border-emerald-500/40"
                }`}
              >
                <span
                  className={`text-[10px] uppercase tracking-wider block ${
                    incentiveStats.balanceRemaining > 0 ? "text-amber-300 font-bold" : "text-emerald-300"
                  }`}
                >
                  Balance to Pay
                </span>
                <div
                  className={`mt-1 text-base sm:text-lg font-black ${
                    incentiveStats.balanceRemaining > 0 ? "text-amber-300" : "text-emerald-400"
                  }`}
                >
                  ₹{incentiveStats.balanceRemaining.toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {incentiveStats.balanceRemaining > 0 ? "Pending staff due" : "All cleared ✓"}
                </span>
              </div>
            </div>

            {/* Form to Log New Payment */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-bold text-purple-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Record Payout to Staff
                </span>
                {incentiveStats.balanceRemaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setPayoutFormAmount(String(incentiveStats.balanceRemaining))}
                    className="text-[10px] text-purple-300 hover:text-white underline cursor-pointer"
                  >
                    Auto-fill balance: ₹{incentiveStats.balanceRemaining}
                  </button>
                )}
              </div>

              <form onSubmit={handleRecordPayout} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Payout Amount (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-purple-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 500"
                        value={payoutFormAmount}
                        onChange={(e) => setPayoutFormAmount(e.target.value)}
                        required
                        className="w-full pl-7 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-400 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={payoutFormMode}
                      onChange={(e) => setPayoutFormMode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="Cash">Cash Drawer</option>
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Recipient / Staff
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Counter Staff"
                      value={payoutFormRecipient}
                      onChange={(e) => setPayoutFormRecipient(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Payout Date
                    </label>
                    <input
                      type="date"
                      value={payoutFormDate}
                      onChange={(e) => setPayoutFormDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Notes / Reference (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cleared for last week gutted sales"
                      value={payoutFormNotes}
                      onChange={(e) => setPayoutFormNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={savingPayout}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingPayout ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                        <span>Recording...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Record Payment Disbursement</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Payouts Ledger Table */}
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block">
                Disbursement History Ledger ({payouts.length})
              </span>

              {payouts.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                  <span className="material-symbols-outlined text-2xl text-slate-600 block mb-1">
                    receipt_long
                  </span>
                  No payments logged yet. Record a payout above when you disburse incentive money to your staff.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Recipient</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3">Notes</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {payouts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                            {p.payout_date}{" "}
                            {p.payout_time && (
                              <span className="text-[10px] text-slate-500">({p.payout_time})</span>
                            )}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-200">
                            {p.recipient_name}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                              {p.payment_mode}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-black text-emerald-400 whitespace-nowrap">
                            ₹{Number(p.amount).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px] max-w-[150px] truncate" title={p.notes}>
                            {p.notes || "—"}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {deletePayoutConfirmId === p.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayout(p.id)}
                                  className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletePayoutConfirmId(null)}
                                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-[9px] cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeletePayoutConfirmId(p.id)}
                                className="p-1 rounded text-slate-500 hover:text-red-400 cursor-pointer"
                                title="Delete payout record"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL 3B: WORKER SALARY MANAGEMENT (MOHD AMIN)
          ══════════════════════════════════════════════════════════ */}
      {isAdmin && salaryModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSalaryModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="bg-slate-900 border border-sky-500/40 rounded-3xl p-5 sm:p-7 max-w-2xl w-full text-slate-200 shadow-2xl space-y-5 my-4 max-h-[92vh] overflow-y-auto font-mono">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sky-400 text-xl">badge</span>
                  <h3 className="text-base sm:text-lg font-black text-white font-['Space_Grotesk']">
                    Vending Center Worker Salary Manager
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                    {salaryConfig.worker_name || "Mohd Amin"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Manage monthly wage disbursements, salary records, and base wage configuration for worker Mohd Amin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSalaryModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Top Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Base Monthly Salary
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingBaseSalary((p) => !p)}
                    className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                  >
                    {editingBaseSalary ? "Close" : "Edit"}
                  </button>
                </div>
                <div className="mt-1 text-base sm:text-lg font-black text-white">
                  ₹{salaryStats.baseMonthly.toLocaleString("en-IN")}
                  <span className="text-xs text-sky-400 font-normal"> / mo</span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Worker: {salaryConfig.worker_name}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Paid for {salaryStats.currentMonthLabel}
                </span>
                <div className="mt-1 text-base sm:text-lg font-black text-emerald-400">
                  ₹{salaryStats.thisMonthPaid.toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  All-time: ₹{salaryStats.allTimePaid.toLocaleString("en-IN")}
                </span>
              </div>

              <div
                className={`p-3 rounded-2xl border ${
                  salaryStats.monthBalanceDue > 0
                    ? "bg-amber-950/20 border-amber-500/40"
                    : "bg-emerald-950/20 border-emerald-500/40"
                }`}
              >
                <span
                  className={`text-[10px] uppercase tracking-wider block ${
                    salaryStats.monthBalanceDue > 0 ? "text-amber-300 font-bold" : "text-emerald-300"
                  }`}
                >
                  Balance Due This Month
                </span>
                <div
                  className={`mt-1 text-base sm:text-lg font-black ${
                    salaryStats.monthBalanceDue > 0 ? "text-amber-300" : "text-emerald-400"
                  }`}
                >
                  ₹{salaryStats.monthBalanceDue.toLocaleString("en-IN")}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {salaryStats.monthBalanceDue > 0 ? "Pending disbursement" : "Current month settled ✓"}
                </span>
              </div>
            </div>

            {/* Edit Base Salary Form (if active) */}
            {editingBaseSalary && (
              <form onSubmit={handleUpdateBaseSalary} className="p-3 rounded-2xl bg-slate-950 border border-sky-500/40 flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">
                    Set Monthly Base Wage for {salaryConfig.worker_name} (₹)
                  </label>
                  <input
                    type="number"
                    value={baseSalaryInput}
                    onChange={(e) => setBaseSalaryInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400 font-bold"
                    placeholder="15000"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-2 mt-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  Update Wage
                </button>
              </form>
            )}

            {/* Form to Log New Salary Payment */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-sky-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-bold text-sky-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Record Salary Payment to {salaryConfig.worker_name}
                </span>
                {salaryStats.monthBalanceDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setSalaryFormAmount(String(salaryStats.monthBalanceDue))}
                    className="text-[10px] text-sky-300 hover:text-white underline cursor-pointer"
                  >
                    Auto-fill due: ₹{salaryStats.monthBalanceDue}
                  </button>
                )}
              </div>

              <form onSubmit={handleAddSalaryPayment} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Salary Amount (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sky-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 15000"
                        value={salaryFormAmount}
                        onChange={(e) => setSalaryFormAmount(e.target.value)}
                        required
                        className="w-full pl-7 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Salary Month / Period
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. September 2026"
                      value={salaryFormMonth}
                      onChange={(e) => setSalaryFormMonth(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={salaryFormMode}
                      onChange={(e) => setSalaryFormMode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400"
                    >
                      <option value="Cash">Cash Drawer</option>
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      value={salaryFormDate}
                      onChange={(e) => setSalaryFormDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] uppercase text-slate-400 block mb-1">
                      Notes / Reference (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Full month salary via counter cash"
                      value={salaryFormNotes}
                      onChange={(e) => setSalaryFormNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={savingSalary}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingSalary ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                        <span>Recording...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Record Salary Payment</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Salary History Ledger */}
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block">
                Salary Payment History ({salaryPayments.length})
              </span>

              {salaryPayments.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                  <span className="material-symbols-outlined text-2xl text-slate-600 block mb-1">
                    receipt_long
                  </span>
                  No salary payments logged yet. Record a payment above when you disburse salary to Mohd Amin.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Month</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3">Notes</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {salaryPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                            {p.payment_date}{" "}
                            {p.payment_time && (
                              <span className="text-[10px] text-slate-500">({p.payment_time})</span>
                            )}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-sky-300 font-bold">
                            {p.salary_month}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                              {p.payment_mode}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-black text-emerald-400 whitespace-nowrap">
                            ₹{Number(p.amount).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px] max-w-[150px] truncate" title={p.notes}>
                            {p.notes || "—"}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {deleteSalaryConfirmId === p.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSalaryPayment(p.id)}
                                  className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteSalaryConfirmId(null)}
                                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-[9px] cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteSalaryConfirmId(p.id)}
                                className="p-1 rounded text-slate-500 hover:text-red-400 cursor-pointer"
                                title="Delete salary payment record"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════
          LOG STOCK MODAL — Add New Biomass Procurement Entry
          ══════════════════════════════════════════════════════════ */}
      {stockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0a1628] border border-blue-500/30 rounded-3xl shadow-2xl shadow-blue-950/40 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="material-symbols-outlined text-blue-400 text-base">inventory_2</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 font-mono">
                    Biomass Procurement
                  </span>
                </div>
                <h3
                  className="text-base font-black text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  Log Stock Intake
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStockModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddStockEntry} className="p-5 space-y-4">
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Date</label>
                  <input
                    type="date"
                    value={stockFormDate}
                    onChange={(e) => setStockFormDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Time</label>
                  <input
                    type="text"
                    value={stockFormTime}
                    onChange={(e) => setStockFormTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                    placeholder="08:00 AM"
                  />
                </div>
              </div>

              {/* Supplier */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={stockFormSupplier}
                  onChange={(e) => setStockFormSupplier(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400"
                  placeholder="Khyber Aquaculture"
                  required
                />
              </div>

              {/* Product Type — always Live Fish */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Stock Type
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                  <span className="material-symbols-outlined text-blue-400 text-base">water</span>
                  <span className="text-sm font-bold text-blue-200">Live Fish</span>
                  <span className="ml-auto text-[10px] font-mono text-slate-400">Procured from supplier</span>
                </div>
              </div>

              {/* Weight & Cost */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Weight (Kg)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={stockFormWeight}
                    onChange={(e) => setStockFormWeight(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                    placeholder="e.g. 50.000"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Cost / Kg (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={stockFormCost}
                    onChange={(e) => setStockFormCost(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                    placeholder="350"
                    required
                  />
                </div>
              </div>

              {/* Live Total Cost Preview */}
              {stockFormWeight && stockFormCost && parseFloat(stockFormWeight) > 0 && parseFloat(stockFormCost) > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/10 border border-violet-500/25">
                  <span className="text-xs font-mono text-slate-400">Total Procurement Cost</span>
                  <span className="text-sm font-black text-violet-300 font-mono">
                    ₹{Math.round(parseFloat(stockFormWeight) * parseFloat(stockFormCost)).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Batch Notes (optional)
                </label>
                <textarea
                  value={stockFormNotes}
                  onChange={(e) => setStockFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-400 resize-none"
                  placeholder="e.g. Fresh batch, morning delivery..."
                />
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStockModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStock}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                >
                  {savingStock ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <span className="material-symbols-outlined text-sm">add</span>
                  )}
                  {savingStock ? "Saving…" : "Log Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════
          LOG MORTALITY & SCRAP MODAL
          ══════════════════════════════════════════════════════════ */}
      {mortalityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#120b12] border border-rose-500/40 rounded-3xl shadow-2xl shadow-rose-950/40 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-rose-500/20">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="material-symbols-outlined text-rose-400 text-base">emergency</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 font-mono">
                    Aquarium Loss Log
                  </span>
                </div>
                <h3
                  className="text-base font-black text-white"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  Record Fish Mortality / Scrap
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMortalityModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddMortalityEntry} className="p-5 space-y-4">
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Date</label>
                  <input
                    type="date"
                    value={mortalityFormDate}
                    onChange={(e) => setMortalityFormDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400 font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Time</label>
                  <input
                    type="text"
                    value={mortalityFormTime}
                    onChange={(e) => setMortalityFormTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400 font-mono"
                    placeholder="09:00 AM"
                  />
                </div>
              </div>

              {/* Weight & Fish Count */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Weight (Kg) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={mortalityFormWeight}
                    onChange={(e) => setMortalityFormWeight(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400 font-mono font-bold"
                    placeholder="e.g. 1.250"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Fish Count *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={mortalityFormCount}
                    onChange={(e) => setMortalityFormCount(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400 font-mono"
                    placeholder="e.g. 2"
                    required
                  />
                </div>
              </div>

              {/* Reason Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Suspected Reason / Cause
                </label>
                <select
                  value={mortalityFormReason}
                  onChange={(e) => setMortalityFormReason(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400 font-mono"
                >
                  <option value="Transport Stress">Transport Stress (Delivery shock)</option>
                  <option value="Water Temp Shock">Water Temp Shock (Chiller issue)</option>
                  <option value="Aeration / DO Drop">Aeration / Low Dissolved Oxygen</option>
                  <option value="Handling / Net Injury">Handling / Net or Scale Damage</option>
                  <option value="Natural Mortality">Natural Mortality / Weak fish</option>
                  <option value="Other">Other Wastage</option>
                </select>
              </div>

              {/* Financial Loss Preview */}
              {mortalityFormWeight && parseFloat(mortalityFormWeight) > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                  <span className="text-xs font-mono text-slate-400">Scrap Cost Loss (@ ₹{procurementAvgCost}/Kg)</span>
                  <span className="text-sm font-black text-rose-300 font-mono">
                    ₹{Math.round(parseFloat(mortalityFormWeight) * procurementAvgCost).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Logged By & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Reported By
                  </label>
                  <input
                    type="text"
                    value={mortalityFormLoggedBy}
                    onChange={(e) => setMortalityFormLoggedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400"
                    placeholder="Mohd Amin"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={mortalityFormNotes}
                    onChange={(e) => setMortalityFormNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-400"
                    placeholder="e.g. Found in morning opening..."
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMortalityModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMortality}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/20"
                >
                  {savingMortality ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <span className="material-symbols-outlined text-sm">emergency</span>
                  )}
                  {savingMortality ? "Saving…" : "Record Mortality"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          EOD TELEGRAM REPORT PREVIEW & DISPATCH MODAL
          ══════════════════════════════════════════════════════════ */}
      {eodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0b1420] border border-sky-500/40 rounded-3xl shadow-2xl shadow-sky-950/50 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-sky-500/20 bg-sky-950/20 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sky-400 text-base">send</span>
                </div>
                <div>
                  <h3
                    className="text-base font-black text-white"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  >
                    End-of-Day Telegram Report
                  </h3>
                  <p className="text-[11px] text-sky-300 font-mono">
                    Live daily briefing for Urban Trout Management Group
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEodModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {eodSuccessNotice && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold font-mono flex items-center gap-2 animate-in fade-in">
                  <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
                  <span>{eodSuccessNotice}</span>
                </div>
              )}

              {/* Telegram Preview Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                    Message Preview (Formatted HTML)
                  </span>
                  <span className="text-[10px] font-mono text-sky-400">Telegram Bot Channel</span>
                </div>
                <div
                  className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto shadow-inner"
                  dangerouslySetInnerHTML={{
                    __html: eodPreviewHtml || "Generating report...",
                  }}
                />
              </div>

              {/* Optional Custom Closing Note */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Optional Counter Closing Note
                </label>
                <input
                  type="text"
                  value={eodCustomNote}
                  onChange={(e) => setEodCustomNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400"
                  placeholder="e.g. Counter closed 8:30 PM. Cash drawer tallied with safe."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setEodModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingEodReport}
                onClick={handleSendEodReport}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60 cursor-pointer flex items-center gap-2 shadow-lg shadow-sky-500/25 active:scale-95"
              >
                {sendingEodReport ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                ) : (
                  <span className="material-symbols-outlined text-sm">send</span>
                )}
                <span>{sendingEodReport ? "Sending to Telegram…" : "Send to Telegram Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          BALANCE REMINDER & RAZORPAY QR MODAL
          ══════════════════════════════════════════════════════════ */}
      <BalanceReminderModal
        isOpen={balanceModalOpen}
        onClose={() => {
          setBalanceModalOpen(false);
          setSelectedBalanceRecord(null);
        }}
        record={selectedBalanceRecord}
        onBalanceUpdated={handleBalanceUpdated}
      />
    </div>
  );
}
