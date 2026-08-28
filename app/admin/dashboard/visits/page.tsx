"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { FarmVisit, VisitStatus } from "@/lib/supabase";
import toast from "react-hot-toast";

const STATUS_CONFIG: Record<VisitStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pending: {
    label: "Pending Verification",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    icon: "hourglass_empty",
  },
  confirmed: {
    label: "Confirmed & Scheduled",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    icon: "check_circle",
  },
  completed: {
    label: "Visit Completed",
    color: "text-cyan-300",
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/30",
    icon: "task_alt",
  },
  cancelled: {
    label: "Cancelled / No Show",
    color: "text-slate-400",
    bg: "bg-slate-500/15",
    border: "border-slate-500/30",
    icon: "cancel",
  },
  rescheduled: {
    label: "Rescheduled",
    color: "text-purple-300",
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
    icon: "update",
  },
};

export default function AdminFarmVisitsPage() {
  const [visits, setVisits] = useState<FarmVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // New visit form state for walk-in manual entry
  const [newVisitorName, setNewVisitorName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newTimeSlot, setNewTimeSlot] = useState("Morning (10:00 AM - 12:00 PM)");
  const [newGuests, setNewGuests] = useState(2);
  const [newPurpose, setNewPurpose] = useState("Live Trout Purchase / Viewing");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/farm-visits");
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.visits)) {
          setVisits(json.visits);
        }
      }
    } catch (err) {
      console.error("Error fetching visits:", err);
      toast.error("Failed to load visits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  const handleStatusChange = async (visitId: string, newStatus: VisitStatus) => {
    setUpdatingId(visitId);
    // Optimistic UI update
    setVisits((prev) =>
      prev.map((v) => (v.id === visitId ? { ...v, status: newStatus } : v))
    );

    try {
      const res = await fetch("/api/farm-visits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: visitId, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update on server");
      toast.success(`Visit status updated to ${newStatus.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
      fetchVisits();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNotes = async (visitId: string) => {
    try {
      const res = await fetch("/api/farm-visits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: visitId,
          status: visits.find((v) => v.id === visitId)?.status || "pending",
          admin_notes: noteText,
        }),
      });

      if (!res.ok) throw new Error("Failed to save note");
      setVisits((prev) =>
        prev.map((v) => (v.id === visitId ? { ...v, admin_notes: noteText } : v))
      );
      toast.success("Admin note saved!");
      setEditingNotesId(null);
    } catch (err) {
      toast.error("Failed to save note");
    }
  };

  const handleCreateManualVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitorName.trim() || !newPhone.trim() || !newDate) {
      toast.error("Please fill in Name, Phone, and Date.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/farm-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_name: newVisitorName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim() || undefined,
          visit_date: newDate,
          time_slot: newTimeSlot,
          guest_count: newGuests,
          visit_purpose: newPurpose,
          special_requests: newNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create visit");

      toast.success("Visit added to schedule!");
      setShowAddModal(false);
      // Reset form
      setNewVisitorName("");
      setNewPhone("");
      setNewEmail("");
      setNewNotes("");
      fetchVisits();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create visit");
    } finally {
      setCreating(false);
    }
  };

  // WhatsApp quick response link generator
  const getWhatsAppMessageUrl = (v: FarmVisit, type: "confirm" | "reminder" | "directions") => {
    const cleanPhone = v.phone.replace(/\D/g, "").slice(-10);
    let text = "";
    if (type === "confirm") {
      text = `Hi ${v.visitor_name}! 🐟 Your farm visit to Urban Trout on ${v.visit_date} (${v.time_slot}) has been CONFIRMED! Our team at Malabagh, Naseem Bagh is looking forward to hosting you for fresh RAS tank viewing. Address: Malabagh, Naseem Bagh, near R P School Girls Wing. Google Maps: https://maps.google.com/?q=34.144709,74.824525`;
    } else if (type === "reminder") {
      text = `Hi ${v.visitor_name}! 🐟 Friendly reminder regarding your scheduled visit to Urban Trout Farm today (${v.visit_date} at ${v.time_slot}). Call us at +91 84910 06127 if you need directions!`;
    } else {
      text = `Hi ${v.visitor_name}! Here are directions to Urban Trout Farm in Naseem Bagh: Located in Malabagh near R P School (Girls Wing). Google Maps link: https://maps.google.com/?q=34.144709,74.824525. Safe travels!`;
    }
    return `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return {
      total: visits.length,
      pending: visits.filter((v) => v.status === "pending").length,
      confirmed: visits.filter((v) => v.status === "confirmed").length,
      completed: visits.filter((v) => v.status === "completed").length,
      today: visits.filter((v) => v.visit_date === todayStr).length,
    };
  }, [visits]);

  // Filtered visits
  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      // Status filter
      if (filter !== "all" && v.status !== filter) return false;
      // Date filter
      if (dateFilter && v.visit_date !== dateFilter) return false;
      // Search term
      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = v.visitor_name.toLowerCase().includes(q);
        const phoneMatch = v.phone.includes(q);
        const purposeMatch = v.visit_purpose.toLowerCase().includes(q);
        const notesMatch = v.special_requests?.toLowerCase().includes(q) || false;
        if (!nameMatch && !phoneMatch && !purposeMatch && !notesMatch) return false;
      }
      return true;
    });
  }, [visits, filter, dateFilter, search]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* ─── Header & Top Actions ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <h1
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              className="text-2xl sm:text-3xl font-extrabold text-white"
            >
              Farm Visits &amp; Pre-Notifications
            </h1>
          </div>
          <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs text-slate-400 mt-1">
            Manage scheduled customer farm visits, live harvest walk-ins, and guest pre-notifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchVisits}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            <span className={`material-symbols-outlined text-base ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:brightness-110 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span>Add Visit</span>
          </button>
        </div>
      </div>

      {/* ─── KPI Stats Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[
          { label: "Total Visits", count: stats.total, color: "text-white", border: "border-slate-800", bg: "bg-slate-900/60", icon: "tour" },
          { label: "Pending Verification", count: stats.pending, color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10", icon: "hourglass_empty" },
          { label: "Confirmed Upcoming", count: stats.confirmed, color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10", icon: "check_circle" },
          { label: "Today's Schedule", count: stats.today, color: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-500/10", icon: "today" },
          { label: "Completed", count: stats.completed, color: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/10", icon: "task_alt" },
        ].map((item, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl border ${item.border} ${item.bg} flex items-center justify-between`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                {item.label}
              </span>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif' }} className={`text-2xl font-bold ${item.color} mt-0.5 block`}>
                {item.count}
              </span>
            </div>
            <span className={`material-symbols-outlined text-2xl ${item.color} opacity-80`}>{item.icon}</span>
          </div>
        ))}
      </div>

      {/* ─── Filters & Search Toolbar ─── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
        
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All Visits", count: stats.total },
            { id: "pending", label: "Pending", count: stats.pending },
            { id: "confirmed", label: "Confirmed", count: stats.confirmed },
            { id: "completed", label: "Completed", count: stats.completed },
            { id: "cancelled", label: "Cancelled", count: visits.filter((v) => v.status === "cancelled").length },
          ].map((tab) => {
            const isSel = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSel
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSel ? "bg-cyan-400 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Date Filter */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-2 text-slate-500 text-base">search</span>
            <input
              type="text"
              placeholder="Search by visitor, phone, purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            )}
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-cyan-400 font-mono"
            title="Filter by visit date"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
              title="Clear date filter"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ─── Visits List Grid ─── */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Loading farm visits...</p>
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="py-16 text-center rounded-3xl bg-slate-950/60 border border-slate-800 p-8 space-y-3">
          <span className="material-symbols-outlined text-4xl text-slate-600">event_busy</span>
          <h3 className="text-base font-bold text-slate-300">No Farm Visits Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {filter !== "all" || search || dateFilter
              ? "No visits match the selected filter criteria."
              : "No farm visits have been pre-notified yet. You can add one manually using the button above."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVisits.map((v) => {
            const statusStyle = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending;
            const isUpdating = updatingId === v.id;
            const cleanPhone = v.phone.replace(/\D/g, "").slice(-10);

            return (
              <div
                key={v.id}
                className="rounded-3xl p-5 sm:p-6 transition-all duration-200 border relative overflow-hidden"
                style={{
                  background: "linear-gradient(155deg, #071722 0%, #031018 100%)",
                  borderColor: v.status === "pending" ? "rgba(251,191,36,0.3)" : "rgba(114,221,253,0.15)",
                }}
              >
                {/* Top Row: Visitor Info & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 flex items-center justify-center font-bold text-base flex-shrink-0">
                      {v.visitor_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 style={{ fontFamily: '"Space Grotesk", sans-serif' }} className="text-base font-bold text-white">
                          {v.visitor_name}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                          {v.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <a href={`tel:+91${cleanPhone}`} className="hover:text-cyan-300 transition-colors font-mono">
                          +91 {cleanPhone}
                        </a>
                        {v.email && (
                          <span className="text-slate-500 hidden sm:inline truncate max-w-[200px]">
                            {v.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status badge & selector */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border ${statusStyle.bg} ${statusStyle.border} ${statusStyle.color}`}>
                      <span className="material-symbols-outlined text-sm">{statusStyle.icon}</span>
                      <span>{statusStyle.label}</span>
                    </div>

                    <select
                      value={v.status}
                      disabled={isUpdating}
                      onChange={(e) => handleStatusChange(v.id, e.target.value as VisitStatus)}
                      className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer disabled:opacity-50"
                    >
                      <option value="pending">Mark Pending</option>
                      <option value="confirmed">Mark Confirmed</option>
                      <option value="completed">Mark Completed</option>
                      <option value="cancelled">Mark Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Middle Row: Date, Time, Group, Purpose, Notes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider font-mono">
                      Requested Date
                    </span>
                    <span className="text-white font-semibold text-sm mt-0.5 block font-mono">
                      {v.visit_date}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider font-mono">
                      Batch Window
                    </span>
                    <span className="text-cyan-300 font-semibold text-xs mt-0.5 block">
                      {v.time_slot}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider font-mono">
                      Group Size
                    </span>
                    <span className="text-slate-200 font-semibold text-xs mt-0.5 block">
                      👥 {v.guest_count} Person(s)
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider font-mono">
                      Purpose
                    </span>
                    <span className="text-slate-200 font-semibold text-xs mt-0.5 block truncate">
                      {v.visit_purpose}
                    </span>
                  </div>
                </div>

                {/* Farm Manager Pending Approval Strip */}
                {v.status === "pending" && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 my-2">
                    <div className="flex items-center gap-2.5 text-amber-300 text-xs">
                      <span className="material-symbols-outlined text-lg text-amber-400">verified_user</span>
                      <div>
                        <span className="font-bold block">Farm Manager Review Required</span>
                        <span className="text-[11px] text-amber-200/80">Approve to automatically email the visitor their official Entry Pass.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-stretch sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(v.id, "confirmed")}
                        disabled={isUpdating}
                        className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-base">mark_email_read</span>
                        <span>Approve &amp; Email Pass</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(v.id, "cancelled")}
                        disabled={isUpdating}
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700 text-xs font-semibold cursor-pointer transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {/* Special Requests & Admin Notes */}
                {(v.special_requests || v.admin_notes || editingNotesId === v.id) && (
                  <div className="pt-2 pb-3 text-xs space-y-2 border-t border-slate-800/60">
                    {v.special_requests && (
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300">
                        <span className="text-slate-500 font-bold text-[10px] uppercase block mb-0.5">Visitor Notes:</span>
                        <p className="italic text-slate-300">&ldquo;{v.special_requests}&rdquo;</p>
                      </div>
                    )}

                    {editingNotesId === v.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          placeholder="Add internal staff notes (e.g. reserving 4kg fish, VIP visitor, etc.)..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveNotes(v.id)}
                            className="px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold cursor-pointer"
                          >
                            Save Note
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNotesId(null)}
                            className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : v.admin_notes ? (
                      <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-cyan-200 flex justify-between items-start">
                        <div>
                          <span className="text-cyan-400 font-bold text-[10px] uppercase block mb-0.5">Internal Note:</span>
                          <p>{v.admin_notes}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesId(v.id);
                            setNoteText(v.admin_notes || "");
                          }}
                          className="text-cyan-400 hover:text-white text-xs underline ml-2"
                        >
                          Edit
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Bottom Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    {/* WhatsApp Quick Actions */}
                    <a
                      href={getWhatsAppMessageUrl(v, "confirm")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">chat</span>
                      <span>Send WA Pass</span>
                    </a>

                    <a
                      href={getWhatsAppMessageUrl(v, "reminder")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">alarm</span>
                      <span>WA Reminder</span>
                    </a>

                    <a
                      href={`tel:+91${cleanPhone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">call</span>
                      <span>Call</span>
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    {editingNotesId !== v.id && !v.admin_notes && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNotesId(v.id);
                          setNoteText(v.admin_notes || "");
                        }}
                        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">edit_note</span>
                        <span>Add Note</span>
                      </button>
                    )}

                    <span className="text-[10px] text-slate-600 font-mono">
                      Created: {new Date(v.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ─── Manual Add Visit Modal ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-950 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 style={{ fontFamily: '"Space Grotesk", sans-serif' }} className="text-xl font-bold text-white">
                Add Farm Visit (Walk-in / Phone)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateManualVisit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Visitor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Farooq Ahmad"
                  value={newVisitorName}
                  onChange={(e) => setNewVisitorName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="8491006127"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="name@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Visit Date *</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Group Size</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newGuests}
                    onChange={(e) => setNewGuests(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Approved Batch Window</label>
                <select
                  value={newTimeSlot}
                  onChange={(e) => setNewTimeSlot(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="10:30 AM – 11:30 AM">Morning Batch (10:30 AM – 11:30 AM)</option>
                  <option value="02:00 PM – 03:00 PM">Afternoon Batch (02:00 PM – 03:00 PM)</option>
                  <option value="04:30 PM – 05:30 PM">Evening Batch (04:30 PM – 05:30 PM)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Purpose of Visit</label>
                <select
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="Live Trout Purchase / Viewing">Live Trout Purchase / Viewing</option>
                  <option value="Family Outing & RAS Farm Tour">Family Outing &amp; RAS Farm Tour</option>
                  <option value="Restaurant / Bulk Sourcing">Restaurant / Bulk Sourcing</option>
                  <option value="Aquaculture & Tech Learning">Aquaculture &amp; Tech Learning</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Special Notes / Requests</label>
                <textarea
                  rows={2}
                  placeholder="e.g. VIP guest, requested 5kg gutted trout..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-bold uppercase tracking-wider text-xs cursor-pointer shadow-lg hover:brightness-110"
                >
                  {creating ? "Adding..." : "Confirm & Add to Schedule"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-3 px-5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Database Schema Helper ─── */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
        <button
          type="button"
          onClick={() => setShowSqlGuide(!showSqlGuide)}
          className="flex items-center justify-between w-full text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-cyan-400">database</span>
            <span className="font-semibold text-slate-300">Supabase Table Migration Info</span>
          </div>
          <span className="material-symbols-outlined text-sm">{showSqlGuide ? "expand_less" : "expand_more"}</span>
        </button>

        {showSqlGuide && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
            <p className="text-[11px] text-slate-400">
              Farm visits work automatically with Supabase fallback. To enable dedicated database indexing in Supabase, run this in your Supabase SQL Editor:
            </p>
            <pre className="p-3 rounded-xl bg-slate-900 text-cyan-300 text-[10px] font-mono overflow-x-auto border border-slate-800">
{`CREATE TABLE IF NOT EXISTS public.farm_visits (
  id TEXT PRIMARY KEY,
  visitor_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  visit_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  guest_count INTEGER DEFAULT 1,
  visit_purpose TEXT NOT NULL,
  special_requests TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`}
            </pre>
          </div>
        )}
      </div>

    </div>
  );
}
