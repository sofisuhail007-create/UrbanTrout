"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminClient";
import PaginationBar from "@/components/PaginationBar";
import * as XLSX from "xlsx";

export interface CustomerRecord {
  id: string;
  phone: string;
  name: string;
  locality: string | null;
  pincode: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  notes?: string | null;
  source?: "vending_counter" | "online" | "inquiry" | string;
}

export interface VendingHistoryEntry {
  id: string;
  entry_date: string;
  entry_time: string;
  weight_kg: number;
  product_type: string;
  rate_per_kg: number;
  amount_paid: number;
  payment_mode: string;
  notes?: string;
  custom_fields?: any;
}

function loyaltyTier(c: CustomerRecord): { label: string; color: string; bg: string; border: string; icon: string } {
  if (c.total_orders >= 5 || c.total_spent >= 5000) {
    return { label: "Premium", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.3)", icon: "workspace_premium" };
  }
  if (c.total_orders >= 2) {
    return { label: "Regular", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.12)", border: "rgba(148, 163, 184, 0.25)", icon: "verified_user" };
  }
  return { label: "New", color: "#22d3ee", bg: "rgba(34, 211, 238, 0.12)", border: "rgba(34, 211, 238, 0.3)", icon: "fiber_new" };
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  if (isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 86400000));
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendingEntries, setVendingEntries] = useState<VendingHistoryEntry[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CustomerRecord | null>(null);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "premium" | "regular" | "new" | "inactive" | "counter" | "online">("all");

  // Multi-select for Broadcast & Batch Operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);

  // Add Customer Form State
  const [addFormName, setAddFormName] = useState("");
  const [addFormPhone, setAddFormPhone] = useState("");
  const [addFormLocality, setAddFormLocality] = useState("");
  const [addFormPincode, setAddFormPincode] = useState("190001");
  const [addFormNotes, setAddFormNotes] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  // Broadcast Form State
  const [broadcastTemplate, setBroadcastTemplate] = useState<"harvest" | "special" | "inactive" | "review" | "custom">("harvest");
  const [broadcastMessage, setBroadcastMessage] = useState(
    "Salam {name}! Fresh Rainbow Trout has just been harvested from our cold-water RAS tanks at Urban Trout Malabagh. Whole and gutted available fresh today. Would you like to reserve yours? 🌊🐟"
  );
  const [broadcastIndex, setBroadcastIndex] = useState(0);

  // Google Review Collector State
  const [googleReviewUrl, setGoogleReviewUrl] = useState("https://g.page/r/CTVKEpV62HMmECE/review");
  const [reviewSentPhones, setReviewSentPhones] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("ut_cust_review_sent_phones") || "[]");
        return new Set(stored);
      } catch { return new Set(); }
    }
    return new Set();
  });

  // Notes inline state
  const [noteValue, setNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // History Tab on Customer detail
  const [historyTab, setHistoryTab] = useState<"all" | "vending" | "online">("all");

  // Feedback Toasts
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  // ── Load Data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, ordRes, vendRes, balRes] = await Promise.all([
        adminFetch("/api/customers"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        adminFetch("/api/vending-log"),
        adminFetch("/api/customer-balance"),
      ]);

      if (custRes.ok) {
        const cJson = await custRes.json();
        if (cJson.success && Array.isArray(cJson.customers)) {
          setCustomers(cJson.customers);
        }
      }

      if (ordRes.data) {
        setOrders(ordRes.data);
      }

      if (vendRes.ok) {
        const vJson = await vendRes.json();
        if (vJson.success && Array.isArray(vJson.entries)) {
          setVendingEntries(vJson.entries);
        }
      }

      if (balRes.ok) {
        const bJson = await balRes.json();
        if (bJson.success && Array.isArray(bJson.records)) {
          setBalances(bJson.records);
        }
      }

      // Fetch Google Review URL setting
      try {
        const { data: revData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "google_review_url")
          .single();
        if (revData?.value && revData.value.startsWith("http")) {
          setGoogleReviewUrl(revData.value);
        }
      } catch (_) {}
    } catch (err) {
      console.warn("Error loading customer database data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Send Review Request for a Customer ────────────────────────────────────
  const handleRequestCustomerReview = (customer: CustomerRecord) => {
    const cleanPhone = customer.phone.replace(/\D/g, "").slice(-10);
    const reviewUrl = googleReviewUrl || "https://g.page/r/CTVKEpV62HMmECE/review";

    const msg = `*URBAN TROUT AQUACULTURE*
_Fresh Himalayan Rainbow Trout · Srinagar_

Dear *${customer.name}*,

Thank you for choosing *Urban Trout*!
We hope you loved your fresh Himalayan Rainbow Trout.

Your feedback means the world to us and helps other trout lovers in Kashmir find us. If you enjoyed your order, please take 30 seconds to leave us a quick Google review:

*Leave us a review on Google:*
${reviewUrl}

It makes a huge difference to our local farm! Thank you for your support.

_Warm regards,_
*Urban Trout Team, Srinagar*`;

    // 1. Copy to clipboard
    try {
      navigator.clipboard.writeText(msg);
    } catch (_) {}

    // 2. Open WhatsApp directly
    const enc = encodeURIComponent(msg);
    const url = cleanPhone.length === 10
      ? `https://wa.me/91${cleanPhone}?text=${enc}`
      : `https://wa.me/?text=${enc}`;
    window.open(url, "_blank");

    // Track
    const newSent = new Set(reviewSentPhones);
    newSent.add(cleanPhone);
    setReviewSentPhones(newSent);
    try {
      localStorage.setItem("ut_cust_review_sent_phones", JSON.stringify([...newSent]));
    } catch (_) {}

    setCopyNotice(`Review request opened on WhatsApp for ${customer.name}!`);
    setTimeout(() => setCopyNotice(null), 3500);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep notes synchronized with selected customer
  useEffect(() => {
    if (selected) {
      setNoteValue(selected.notes ?? "");
      setNoteSaved(false);
    }
  }, [selected]);

  // ── Save Note Handler ──────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    try {
      const res = await adminFetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          phone: selected.phone,
          notes: noteValue,
        }),
      });

      if (res.ok) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === selected.id ? { ...c, notes: noteValue } : c))
        );
        setSelected((prev) => (prev ? { ...prev, notes: noteValue } : prev));
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save customer notes:", err);
    } finally {
      setSavingNote(false);
    }
  };

  // ── Delete Customer Handler ────────────────────────────────────────────────
  const handleDeleteCustomer = async (customer: CustomerRecord) => {
    if (
      !window.confirm(
        `Are you sure you want to delete customer ${customer.name} (+91 ${customer.phone})? This will remove them from the database.`
      )
    ) {
      return;
    }

    try {
      const res = await adminFetch(`/api/customers?id=${encodeURIComponent(customer.id)}&phone=${encodeURIComponent(customer.phone)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
        setSelectedIds((prev) => prev.filter((id) => id !== customer.id));
        if (selected?.id === customer.id) setSelected(null);
      }
    } catch (err: any) {
      alert(`Failed to delete customer: ${err?.message || err}`);
    }
  };

  // ── Bulk Delete Handler ────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} selected customer records? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await adminFetch("/api/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        setCustomers((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
        if (selected && selectedIds.includes(selected.id)) {
          setSelected(null);
        }
        setSelectedIds([]);
      }
    } catch (err: any) {
      alert(`Bulk delete error: ${err?.message || err}`);
    }
  };

  // ── Add Customer Manually ──────────────────────────────────────────────────
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = addFormPhone.replace(/\D/g, "").slice(-10);
    if (!addFormName.trim()) {
      alert("Please enter customer name.");
      return;
    }
    if (clean.length !== 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    setAddingCustomer(true);
    try {
      const res = await adminFetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addFormName.trim(),
          phone: clean,
          locality: addFormLocality.trim() || "Srinagar",
          pincode: addFormPincode.trim() || "190001",
          notes: addFormNotes.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.customer) {
          setCustomers((prev) => [data.customer, ...prev.filter((c) => c.phone !== clean)]);
          setSelected(data.customer);
          setAddModalOpen(false);
          setAddFormName("");
          setAddFormPhone("");
          setAddFormLocality("");
          setAddFormNotes("");
        }
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add customer");
      }
    } catch (err: any) {
      alert(`Error adding customer: ${err?.message || err}`);
    } finally {
      setAddingCustomer(false);
    }
  };

  // ── Filtered Customers ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.locality ?? "").toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q);

      if (!matchSearch) return false;

      const days = daysSince(c.last_order_at);
      const isInactive = days !== null && days > 30;
      const isCounter = c.source === "vending_counter" || (c.notes || "").toLowerCase().includes("vending");
      const isOnline = !isCounter;

      if (tierFilter === "premium") {
        return c.total_orders >= 5 || c.total_spent >= 5000;
      }
      if (tierFilter === "regular") {
        return c.total_orders >= 2 && c.total_orders < 5 && c.total_spent < 5000;
      }
      if (tierFilter === "new") {
        return c.total_orders <= 1;
      }
      if (tierFilter === "inactive") {
        return isInactive;
      }
      if (tierFilter === "counter") {
        return isCounter;
      }
      if (tierFilter === "online") {
        return isOnline;
      }
      return true;
    });
  }, [customers, search, tierFilter]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => {
    setCurrentPage(1);
  }, [search, tierFilter]);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * 50;
    return filtered.slice(start, start + 50);
  }, [filtered, currentPage]);

  // ── Selected Customer Related Data ─────────────────────────────────────────
  const selectedCleanPhone = useMemo(() => {
    return selected ? selected.phone.replace(/\D/g, "").slice(-10) : "";
  }, [selected]);

  const customerOrders = useMemo(() => {
    if (!selectedCleanPhone) return [];
    return orders.filter(
      (o) => (o.customer_phone || "").replace(/\D/g, "").slice(-10) === selectedCleanPhone
    );
  }, [orders, selectedCleanPhone]);

  const customerVendingEntries = useMemo(() => {
    if (!selectedCleanPhone) return [];
    return vendingEntries.filter((v) => {
      const vPhone = (v.custom_fields?.customer_phone || (v as any).customer_phone || "")
        .replace(/\D/g, "")
        .slice(-10);
      return vPhone === selectedCleanPhone;
    });
  }, [vendingEntries, selectedCleanPhone]);

  const customerBalanceRecord = useMemo(() => {
    if (!selectedCleanPhone) return null;
    return balances.find((b) => {
      const bPhone = (b.customer_phone || "").replace(/\D/g, "").slice(-10);
      return bPhone === selectedCleanPhone && b.status === "pending" && Number(b.balance_amount) > 0;
    });
  }, [balances, selectedCleanPhone]);

  // ── Multi-select Helpers ───────────────────────────────────────────────────
  const toggleSelectCustomer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = () => {
    const pageIds = paginatedCustomers.map((c) => c.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleSelectAllFiltered = () => {
    const allIds = filtered.map((c) => c.id);
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  // ── Export CSV Handler ─────────────────────────────────────────────────────
  const handleExportCSV = (target: "selected" | "all") => {
    const list = target === "selected" && selectedIds.length > 0
      ? customers.filter((c) => selectedIds.includes(c.id))
      : filtered;

    if (list.length === 0) {
      alert("No customers to export.");
      return;
    }

    const rows = list.map((c, idx) => {
      const tier = loyaltyTier(c);
      const days = daysSince(c.last_order_at);
      return {
        "#": idx + 1,
        "Customer Name": c.name,
        "Mobile Number": `+91 ${c.phone}`,
        "WhatsApp Link": `https://wa.me/91${c.phone}`,
        "Loyalty Tier": tier.label,
        "Source Channel": c.source === "vending_counter" ? "Vending Counter" : "Online Shop",
        "Total Orders": c.total_orders,
        "Total Revenue Spent (Rs)": c.total_spent,
        "Last Purchase Date": c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("en-IN") : "Never",
        "Days Inactive": days !== null ? days : "N/A",
        "Locality / Area": c.locality || "",
        "Pincode": c.pincode || "",
        "Customer Notes": c.notes || "",
        "Member Since": new Date(c.created_at).toLocaleDateString("en-IN"),
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Customers CRM Database");
    XLSX.writeFile(
      wb,
      `UrbanTrout_Customers_CRM_${target === "selected" ? "Selected" : "All"}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // ── Copy Phone Numbers to Clipboard ────────────────────────────────────────
  const handleCopyNumbers = (target: "selected" | "all") => {
    const list = target === "selected" && selectedIds.length > 0
      ? customers.filter((c) => selectedIds.includes(c.id))
      : filtered;

    if (list.length === 0) return;

    const numbers = list.map((c) => `+91${c.phone.replace(/\D/g, "").slice(-10)}`).join(", ");
    navigator.clipboard.writeText(numbers);
    setCopyNotice(`Copied ${list.length} phone numbers to clipboard!`);
    setTimeout(() => setCopyNotice(null), 3500);
  };

  // ── High Level KPI Stats ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = customers.length;
    let premium = 0;
    let regular = 0;
    let newCount = 0;
    let inactive = 0;
    let totalRevenue = 0;
    let counterCount = 0;

    customers.forEach((c) => {
      totalRevenue += Number(c.total_spent) || 0;
      if (c.total_orders >= 5 || c.total_spent >= 5000) {
        premium += 1;
      } else if (c.total_orders >= 2) {
        regular += 1;
      } else {
        newCount += 1;
      }

      const days = daysSince(c.last_order_at);
      if (days !== null && days > 30) {
        inactive += 1;
      }

      if (c.source === "vending_counter" || (c.notes || "").toLowerCase().includes("vending")) {
        counterCount += 1;
      }
    });

    return { total, premium, regular, newCount, inactive, totalRevenue, counterCount };
  }, [customers]);

  // ── WhatsApp Broadcast Recipients Queue ────────────────────────────────────
  const broadcastList = useMemo(() => {
    if (selectedIds.length > 0) {
      return customers.filter((c) => selectedIds.includes(c.id));
    }
    return filtered;
  }, [customers, selectedIds, filtered]);

  const currentBroadcastCustomer = broadcastList[broadcastIndex] || broadcastList[0];

  const getPersonalizedMessage = (c?: CustomerRecord) => {
    const target = c || currentBroadcastCustomer;
    if (!target) return broadcastMessage;
    const name = target.name && target.name !== "Customer" ? target.name : "valued customer";
    const days = daysSince(target.last_order_at) || 30;
    return broadcastMessage
      .replace(/{name}/g, name)
      .replace(/{days}/g, String(days))
      .replace(/{phone}/g, target.phone);
  };

  const handleLaunchWhatsApp = (c?: CustomerRecord) => {
    const target = c || currentBroadcastCustomer;
    if (!target) return;
    const clean = target.phone.replace(/\D/g, "").slice(-10);
    const msg = encodeURIComponent(getPersonalizedMessage(target));
    window.open(`https://wa.me/91${clean}?text=${msg}`, "_blank");
  };

  const handleLaunchAllTabs = () => {
    if (broadcastList.length > 15) {
      if (
        !window.confirm(
          `You are about to open ${broadcastList.length} WhatsApp tabs. Your browser might block popups for more than a few. Continue?`
        )
      ) {
        return;
      }
    }
    broadcastList.forEach((c, idx) => {
      setTimeout(() => {
        const clean = c.phone.replace(/\D/g, "").slice(-10);
        const msg = encodeURIComponent(getPersonalizedMessage(c));
        window.open(`https://wa.me/91${clean}?text=${msg}`, "_blank");
      }, idx * 600);
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Notification Toast ───────────────────────────────────────────────── */}
      {copyNotice && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-bold shadow-2xl">
          <span className="material-symbols-outlined text-xl font-black">check_circle</span>
          <span className="text-xs font-mono">{copyNotice}</span>
        </div>
      )}

      {/* ── Top Header & Executive Database KPIs ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
              CRM & Database Management
            </span>
            <span className="text-xs font-mono text-slate-500">Live Marketing Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Customer Intelligence Database
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Auto-captured customer base from counter vending sales, POS dispatches & online store orders.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>Add Customer</span>
          </button>

          <button
            type="button"
            onClick={() => setBroadcastModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
            title="Launch WhatsApp marketing campaign"
          >
            <span className="material-symbols-outlined text-base">campaign</span>
            <span>Broadcast (WhatsApp)</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportCSV("all")}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-all cursor-pointer"
            title="Export full database to Excel / CSV"
          >
            <span className="material-symbols-outlined text-base">file_download</span>
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>
      </div>

      {/* ── KPI Flashcards Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Database */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-mono font-bold">Total Clients</span>
            <span className="material-symbols-outlined text-base text-cyan-400">group</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white font-mono">{kpis.total}</span>
            <span className="text-[10px] text-slate-500 block font-mono">registered contacts</span>
          </div>
        </div>

        {/* Premium Loyalists */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[10px] uppercase font-mono font-bold">Premium</span>
            <span className="material-symbols-outlined text-base">workspace_premium</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-300 font-mono">{kpis.premium}</span>
            <span className="text-[10px] text-amber-400/70 block font-mono">5+ orders / ₹5k+</span>
          </div>
        </div>

        {/* Regulars */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-mono font-bold">Regulars</span>
            <span className="material-symbols-outlined text-base text-slate-300">verified_user</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-200 font-mono">{kpis.regular}</span>
            <span className="text-[10px] text-slate-500 block font-mono">2-4 orders</span>
          </div>
        </div>

        {/* New / Counter */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyan-400">
            <span className="text-[10px] uppercase font-mono font-bold">New Clients</span>
            <span className="material-symbols-outlined text-base">fiber_new</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-cyan-300 font-mono">{kpis.newCount}</span>
            <span className="text-[10px] text-cyan-400/70 block font-mono">1st purchase</span>
          </div>
        </div>

        {/* Inactive Re-engagement */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-rose-500/30 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-[10px] uppercase font-mono font-bold">Inactive 30d+</span>
            <span className="material-symbols-outlined text-base">schedule</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-300 font-mono">{kpis.inactive}</span>
            <span className="text-[10px] text-rose-400/70 block font-mono">Needs re-engagement</span>
          </div>
        </div>

        {/* Total Spend */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[10px] uppercase font-mono font-bold">Lifetime Revenue</span>
            <span className="material-symbols-outlined text-base">payments</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-300 font-mono">
              ₹{kpis.totalRevenue.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-emerald-400/70 block font-mono">client sales total</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Chips Bar ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search customers by name, phone (+91), area, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-colors shadow-inner"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: "all", label: `All (${customers.length})` },
              { id: "premium", label: `⭐ Premium (${kpis.premium})` },
              { id: "regular", label: `Regular (${kpis.regular})` },
              { id: "new", label: `New (${kpis.newCount})` },
              { id: "inactive", label: `⏳ Inactive (${kpis.inactive})` },
              { id: "counter", label: `🐟 Vending Counter` },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setTierFilter(chip.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                  tierFilter === chip.id
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                    : "bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Bulk Actions Floating Toolbar (When items selected) ──────────────── */}
        {selectedIds.length > 0 && (
          <div className="animate-in fade-in slide-in-from-top-2 p-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border-2 border-cyan-500/50 shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs font-mono">
                {selectedIds.length} Selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Clear selection
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Broadcast to selected */}
              <button
                type="button"
                onClick={() => setBroadcastModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all cursor-pointer active:scale-95 shadow-md shadow-emerald-500/20"
              >
                <span className="material-symbols-outlined text-sm font-black">send</span>
                <span>Broadcast to {selectedIds.length} (WhatsApp)</span>
              </button>

              {/* Review Broadcast to selected */}
              <button
                type="button"
                onClick={() => {
                  setBroadcastTemplate("review");
                  setBroadcastMessage(
                    `*URBAN TROUT AQUACULTURE*\n_Fresh Himalayan Rainbow Trout · Srinagar_\n\nDear *{name}*,\n\nThank you for being a valued customer of *Urban Trout*!\n\nIf you have enjoyed our fresh trout, we would be deeply grateful for a quick Google review. It takes 30 seconds and helps other trout lovers in Kashmir find our farm:\n\n*Leave us a review on Google:*\n${googleReviewUrl || "https://g.page/r/CTVKEpV62HMmECE/review"}\n\nThank you for supporting local aquaculture!\n\n_Warm regards,_\n*Urban Trout Team, Srinagar*`
                  );
                  setBroadcastModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs transition-all cursor-pointer active:scale-95 shadow-md shadow-yellow-500/20"
              >
                <span>⭐</span>
                <span>Ask Review ({selectedIds.length})</span>
              </button>

              {/* Copy Selected Numbers */}
              <button
                type="button"
                onClick={() => handleCopyNumbers("selected")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-mono text-xs transition-all cursor-pointer"
                title="Copy comma-separated phone numbers for WhatsApp broadcast list"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                <span>Copy Numbers</span>
              </button>

              {/* Export Selected */}
              <button
                type="button"
                onClick={() => handleExportCSV("selected")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Export CSV</span>
              </button>

              {/* Bulk Delete */}
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main 2-Column CRM Workspace ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Customers List (5 Cols) ────────────────────────────── */}
        <div className="lg:col-span-5 space-y-3">
          {/* Select all header */}
          <div className="flex items-center justify-between px-2 text-xs font-mono text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={
                  paginatedCustomers.length > 0 &&
                  paginatedCustomers.every((c) => selectedIds.includes(c.id))
                }
                onChange={handleSelectAllOnPage}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Select all on page ({paginatedCustomers.length})</span>
            </label>

            {filtered.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
              >
                {selectedIds.length === filtered.length ? "Deselect All" : `Select All ${filtered.length}`}
              </button>
            )}
          </div>

          {/* List Cards */}
          {loading ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-3xl border border-slate-800 space-y-3">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-mono text-xs">Loading customer directory...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
              <span className="material-symbols-outlined text-4xl text-slate-700">person_off</span>
              <p className="font-bold text-sm text-slate-300">No customers found</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No entries match your search or filter. You can click &quot;Add Customer&quot; above or log sales at the vending center.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedCustomers.map((c) => {
                const tier = loyaltyTier(c);
                const days = daysSince(c.last_order_at);
                const isInactive = days !== null && days > 30;
                const isSelectedRow = selected?.id === c.id;
                const isChecked = selectedIds.includes(c.id);
                const isCounter = c.source === "vending_counter" || (c.notes || "").toLowerCase().includes("vending");

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                      isSelectedRow
                        ? "bg-gradient-to-r from-cyan-950/40 to-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/40"
                        : "bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      {/* Checkbox + Name */}
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedIds((prev) =>
                              isChecked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-sm text-white group-hover:text-cyan-300 transition-colors">
                              {c.name}
                            </span>
                            {isCounter && (
                              <span
                                className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30"
                                title="Captured at Counter Vending Center"
                              >
                                Counter
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono text-slate-400 block mt-0.5">
                            +91 {c.phone}
                          </span>
                        </div>
                      </div>

                      {/* Tier Badge & Spend */}
                      <div className="text-right flex flex-col items-end">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shadow-sm"
                          style={{
                            color: tier.color,
                            backgroundColor: tier.bg,
                            borderColor: tier.border,
                          }}
                        >
                          <span className="material-symbols-outlined text-[12px]">{tier.icon}</span>
                          <span>{tier.label}</span>
                        </span>
                        <span className="text-xs font-mono font-black text-emerald-400 mt-1">
                          ₹{c.total_spent?.toLocaleString("en-IN") || 0}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Metadata row */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-2 truncate">
                        <span>
                          {c.total_orders} order{c.total_orders !== 1 ? "s" : ""}
                        </span>
                        {c.locality && (
                          <>
                            <span className="text-slate-700">•</span>
                            <span className="text-slate-500 truncate">{c.locality}</span>
                          </>
                        )}
                        {reviewSentPhones.has(c.phone.replace(/\D/g, "").slice(-10)) && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                            ⭐ Asked
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Quick 1-Click Review Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestCustomerReview(c);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/25 text-yellow-300 border border-yellow-500/30 text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title={`Send WhatsApp Google Review Request to ${c.name}`}
                        >
                          <span>⭐</span>
                          <span>Review</span>
                        </button>

                        {isInactive ? (
                          <span className="flex items-center gap-1 text-rose-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            {days}d inactive
                          </span>
                        ) : c.last_order_at ? (
                          <span className="text-slate-500">
                            {new Date(c.last_order_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <PaginationBar
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={50}
            onPageChange={setCurrentPage}
            itemLabel="customers"
            themeColor="cyan"
            className="rounded-2xl border border-slate-800"
          />
        </div>

        {/* ── Right Column: Customer 360 Detail Panel (7 Cols) ────────────────── */}
        <div className="lg:col-span-7">
          {!selected ? (
            <div className="p-16 text-center bg-slate-900/40 rounded-3xl border border-slate-800 flex flex-col items-center justify-center space-y-4 min-h-[460px]">
              <div className="w-16 h-16 rounded-full bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-3xl">contact_page</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Customer 360 Detail View</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Select any customer on the left to see their complete history, launch direct WhatsApp chats, copy numbers, view counter dispatches, and save customer preferences.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-xl">
              {/* 1. Header with Identity & Quick Actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-xl sm:text-2xl font-black text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {selected.name}
                    </h2>
                    {(() => {
                      const tier = loyaltyTier(selected);
                      return (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border"
                          style={{
                            color: tier.color,
                            backgroundColor: tier.bg,
                            borderColor: tier.border,
                          }}
                        >
                          <span className="material-symbols-outlined text-xs">{tier.icon}</span>
                          <span>{tier.label} Client</span>
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span className="font-bold text-white">+91 {selected.phone}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`+91${selected.phone.replace(/\D/g, "").slice(-10)}`);
                        setCopyNotice("Phone number copied!");
                        setTimeout(() => setCopyNotice(null), 3000);
                      }}
                      className="p-1 rounded-md hover:bg-slate-800 text-slate-500 hover:text-cyan-300 transition-colors"
                      title="Copy phone number"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                    </button>
                    {selected.locality && (
                      <>
                        <span className="text-slate-700">•</span>
                        <span>{selected.locality}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Primary CTA Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* ⭐ Request Google Review */}
                  <button
                    type="button"
                    onClick={() => handleRequestCustomerReview(selected)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer shadow-md ${
                      reviewSentPhones.has(selected.phone.replace(/\D/g, "").slice(-10))
                        ? "bg-yellow-950/40 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-950/60"
                        : "bg-yellow-500 hover:bg-yellow-400 text-slate-950 shadow-yellow-500/20"
                    }`}
                    title="Send WhatsApp message asking for a Google review"
                  >
                    <span>⭐</span>
                    <span>
                      {reviewSentPhones.has(selected.phone.replace(/\D/g, "").slice(-10))
                        ? "Review Requested ✓"
                        : "Request Review"}
                    </span>
                  </button>

                  {/* WhatsApp One-Click */}
                  <a
                    href={`https://wa.me/91${selected.phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(
                      `Salam ${selected.name}! Hope you are doing well. Reaching out from Urban Trout Harwan.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base font-black">chat</span>
                    <span>WhatsApp</span>
                  </a>

                  {/* Phone Call */}
                  <a
                    href={`tel:+91${selected.phone.replace(/\D/g, "").slice(-10)}`}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-cyan-400">call</span>
                    <span>Call</span>
                  </a>

                  {/* Delete Customer */}
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomer(selected)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition-colors cursor-pointer"
                    title="Delete customer"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>

              {/* 2. Customer Financial & Engagement Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Spent</span>
                  <span className="text-lg font-black font-mono text-emerald-400 mt-1 block">
                    ₹{selected.total_spent?.toLocaleString("en-IN") || 0}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Purchases</span>
                  <span className="text-lg font-black font-mono text-cyan-300 mt-1 block">
                    {selected.total_orders || 0} order{selected.total_orders !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Recency</span>
                  {(() => {
                    const days = daysSince(selected.last_order_at);
                    if (days === null) {
                      return <span className="text-sm font-mono text-slate-500 mt-1 block">No orders yet</span>;
                    }
                    if (days === 0) {
                      return <span className="text-sm font-mono font-bold text-emerald-400 mt-1 block">Today ✓</span>;
                    }
                    if (days > 30) {
                      return <span className="text-sm font-mono font-bold text-rose-400 mt-1 block">{days} days ago (Inactive)</span>;
                    }
                    return <span className="text-sm font-mono font-bold text-slate-200 mt-1 block">{days} days ago</span>;
                  })()}
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Member Since</span>
                  <span className="text-xs font-mono text-slate-300 mt-1.5 block">
                    {new Date(selected.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>

              {/* 3. Pending Khata Balance Banner (if applicable) */}
              {customerBalanceRecord && (
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-2xl text-amber-400">warning</span>
                    <div>
                      <span className="text-xs font-mono font-bold text-amber-200 block">
                        Pending Khata Balance: ₹{Number(customerBalanceRecord.balance_amount).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[11px] font-mono text-amber-400/80 block">
                        Recorded on invoice #{customerBalanceRecord.invoice_id}
                      </span>
                    </div>
                  </div>
                  <a
                    href="/admin/dashboard/billing/balance-reminder"
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs font-mono hover:bg-amber-400 transition-colors"
                  >
                    Open Khata Tab
                  </a>
                </div>
              )}

              {/* 4. Marketing Delivery Notes & Preferences */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase font-mono font-bold text-slate-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-cyan-400">note_alt</span>
                    <span>Customer Notes & Marketing Preferences</span>
                  </label>
                  {noteSaved && (
                    <span className="text-xs text-emerald-400 font-mono flex items-center gap-1 animate-in fade-in">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Notes Saved
                    </span>
                  )}
                </div>
                <textarea
                  value={noteValue}
                  onChange={(e) => {
                    setNoteValue(e.target.value);
                    setNoteSaved(false);
                  }}
                  rows={3}
                  placeholder="E.g. Prefers large 350g gutted fish, requests Saturday evening dispatches, VIP customer referral..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono transition-colors resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingNote ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </div>

              {/* 5. Complete Purchase History (Vending Dispatches + Online Orders) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs uppercase font-mono font-bold text-slate-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-400">history</span>
                    <span>Purchase Ledger & Dispatches</span>
                  </h4>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setHistoryTab("all")}
                      className={`px-2 py-0.5 rounded-md ${
                        historyTab === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      All ({customerVendingEntries.length + customerOrders.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryTab("vending")}
                      className={`px-2 py-0.5 rounded-md ${
                        historyTab === "vending" ? "bg-slate-800 text-teal-300 font-bold" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      Counter ({customerVendingEntries.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryTab("online")}
                      className={`px-2 py-0.5 rounded-md ${
                        historyTab === "online" ? "bg-slate-800 text-cyan-300 font-bold" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      Online ({customerOrders.length})
                    </button>
                  </div>
                </div>

                {/* History Items Container */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {/* Empty State */}
                  {customerVendingEntries.length === 0 && customerOrders.length === 0 && (
                    <p className="text-xs text-slate-600 font-mono py-4 text-center">
                      No past purchase records linked to this phone number yet.
                    </p>
                  )}

                  {/* Vending Counter Entries */}
                  {(historyTab === "all" || historyTab === "vending") &&
                    customerVendingEntries.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 rounded-xl bg-teal-500/15 text-teal-300 border border-teal-500/30">
                            <span className="material-symbols-outlined text-sm block">storefront</span>
                          </span>
                          <div>
                            <span className="font-bold text-white block">
                              🐟 {v.product_type} — {v.weight_kg} Kg
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {v.entry_date} at {v.entry_time} · {v.payment_mode}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-cyan-300 text-sm block">
                            ₹{Number(v.amount_paid).toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-slate-500">Counter Sale</span>
                        </div>
                      </div>
                    ))}

                  {/* Online Orders Entries */}
                  {(historyTab === "all" || historyTab === "online") &&
                    customerOrders.map((o) => (
                      <div
                        key={o.id}
                        className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <span className="material-symbols-outlined text-sm block">shopping_bag</span>
                          </span>
                          <div>
                            <span className="font-bold text-white block">
                              Order #{o.order_number} ({o.status})
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(o.created_at).toLocaleDateString("en-IN")} · {(o.items || []).length} items
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-cyan-300 text-sm block">
                            ₹{Number(o.total).toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-slate-500">Online Store</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL 1: ADD NEW CUSTOMER MANUALLY
          ════════════════════════════════════════════════════════════════════════ */}
      {addModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full text-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-cyan-400">Marketing Directory</span>
                <h3 className="text-lg font-black text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Add New Customer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
                  Customer Full Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Altaf Hussain / Tariq Sb"
                  value={addFormName}
                  onChange={(e) => setAddFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
                  Mobile Number (WhatsApp) <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={addFormPhone}
                    onChange={(e) => setAddFormPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
                    Locality / Area
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajbagh"
                    value={addFormLocality}
                    onChange={(e) => setAddFormLocality(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="190008"
                    value={addFormPincode}
                    onChange={(e) => setAddFormPincode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
                  Initial Notes / Preferences
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Counter walk-in, likes whole trout"
                  value={addFormNotes}
                  onChange={(e) => setAddFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={addingCustomer}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                >
                  {addingCustomer ? "Saving to Database..." : "Save Customer Contact (✓)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL 2: BROADCAST WHATSAPP CAMPAIGN COMPOSER
          ════════════════════════════════════════════════════════════════════════ */}
      {broadcastModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setBroadcastModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-7 max-w-lg w-full text-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-emerald-400">Marketing Campaign</span>
                <h3 className="text-lg font-black text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Broadcast Message (WhatsApp)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Target Audience Pill */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Audience:</span>
              <span className="font-bold text-emerald-300">
                {selectedIds.length > 0
                  ? `${selectedIds.length} Selected Customer(s)`
                  : `${filtered.length} Filtered Customers`}
              </span>
            </div>

            {/* Preset Templates */}
            <div>
              <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1.5">
                Quick Campaign Templates
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastTemplate("harvest");
                    setBroadcastMessage(
                      "Salam {name}! Fresh Rainbow Trout has just been harvested from our cold-water RAS tanks at Urban Trout Malabagh. Whole and gutted available fresh today. Would you like to reserve yours? 🌊🐟"
                    );
                  }}
                  className={`p-2 rounded-xl text-center text-xs font-mono transition-all cursor-pointer ${
                    broadcastTemplate === "harvest"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  🐟 Fresh Harvest
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastTemplate("special");
                    setBroadcastMessage(
                      "Salam {name}! Planning a special family dinner? Fresh crystal-clear Rainbow Trout is ready at Urban Trout Srinagar. Reply here to arrange delivery or vending center pickup! 🍽️✨"
                    );
                  }}
                  className={`p-2 rounded-xl text-center text-xs font-mono transition-all cursor-pointer ${
                    broadcastTemplate === "special"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  🏷️ Weekend Special
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastTemplate("inactive");
                    setBroadcastMessage(
                      "Salam {name}! It has been a while since your last trout order with us. We have pristine fresh rainbow trout stocked today in Harwan. Let us know if you'd like your favorite portion dispatched! 🌊"
                    );
                  }}
                  className={`p-2 rounded-xl text-center text-xs font-mono transition-all cursor-pointer ${
                    broadcastTemplate === "inactive"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ⏰ Re-engagement
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastTemplate("review");
                    setBroadcastMessage(
                      `*URBAN TROUT AQUACULTURE*\n_Fresh Himalayan Rainbow Trout · Srinagar_\n\nDear *{name}*,\n\nThank you for choosing *Urban Trout*!\nWe hope you loved your fresh Himalayan Rainbow Trout.\n\nYour feedback means the world to us and helps other trout lovers in Kashmir find us. If you enjoyed your order, please take 30 seconds to leave us a quick Google review:\n\n*Leave us a review on Google:*\n${googleReviewUrl || "https://g.page/r/CTVKEpV62HMmECE/review"}\n\nIt makes a huge difference to our local farm! Thank you for your support.\n\n_Warm regards,_\n*Urban Trout Team, Srinagar*`
                    );
                  }}
                  className={`p-2 rounded-xl text-center text-xs font-mono transition-all cursor-pointer ${
                    broadcastTemplate === "review"
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 font-bold"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ⭐ Google Review
                </button>
              </div>
            </div>

            {/* Message Body Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-mono font-bold text-slate-400">
                  Message Content (Supports {"{name}"} tag)
                </label>
                <span className="text-[10px] text-cyan-400 font-mono">Dynamic Personalization</span>
              </div>
              <textarea
                rows={4}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400 font-mono resize-none leading-relaxed"
              />
            </div>

            {/* Dynamic Preview for Current Target */}
            {currentBroadcastCustomer && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
                  <span>Live Preview for: {currentBroadcastCustomer.name}</span>
                  <span>+91 {currentBroadcastCustomer.phone}</span>
                </div>
                <p className="text-slate-300 italic pt-1 text-[11px] leading-relaxed">
                  &quot;{getPersonalizedMessage(currentBroadcastCustomer)}&quot;
                </p>
              </div>
            )}

            {/* Campaign Dispatch Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleLaunchWhatsApp()}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                <span>Send WhatsApp to {currentBroadcastCustomer?.name || "Recipient"}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (broadcastIndex + 1) % broadcastList.length;
                    setBroadcastIndex(nextIdx);
                    handleLaunchWhatsApp(broadcastList[nextIdx]);
                  }}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">skip_next</span>
                  <span>Next & Send ({broadcastIndex + 1}/{broadcastList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleLaunchAllTabs}
                  className="py-2 px-3 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  title="Open tabs in sequence for all recipients"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  <span>Open Tabs for All ({broadcastList.length})</span>
                </button>
              </div>

              {/* Copy Phone Numbers Option */}
              <button
                type="button"
                onClick={() => handleCopyNumbers(selectedIds.length > 0 ? "selected" : "all")}
                className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-mono transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                <span>Copy all {broadcastList.length} numbers for WhatsApp Web broadcast list</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
