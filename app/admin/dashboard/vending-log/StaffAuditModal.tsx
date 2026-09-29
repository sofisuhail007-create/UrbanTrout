"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AuditLogEntry } from "@/lib/auditLog";

interface StaffAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  targetEntryId?: string | null;
}

export default function StaffAuditModal({
  isOpen,
  onClose,
  adminFetch,
  targetEntryId,
}: StaffAuditModalProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "7days" | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = targetEntryId
        ? `/api/audit-log?entity_id=${encodeURIComponent(targetEntryId)}&limit=100`
        : `/api/audit-log?limit=500`;

      const res = await adminFetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.logs || []);
      } else {
        setError(data.error || "Failed to load audit history.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to audit service.");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, targetEntryId]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Compute Indian Standard Time dates for quick filters
  const { todayIst, yesterdayIst } = useMemo(() => {
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const yDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yest = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(yDate);

    return { todayIst: today, yesterdayIst: yest };
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Staff filter
      if (staffFilter !== "all") {
        const actor = (log.actor_name || "").toLowerCase();
        const email = (log.actor_email || "").toLowerCase();
        if (staffFilter === "amin") {
          if (!actor.includes("amin") && !email.includes("amin") && !email.includes("work.suhail007")) {
            return false;
          }
        } else if (staffFilter === "suhail") {
          if (!actor.includes("suhail") && !email.includes("sofisuhail007")) {
            return false;
          }
        }
      }

      // Action filter
      if (actionFilter !== "all") {
        if (actionFilter === "modifications" && log.action !== "UPDATE_ENTRY" && log.action !== "UPDATE_EXPENSE") {
          return false;
        }
        if (actionFilter === "additions" && log.action !== "CREATE_ENTRY" && log.action !== "CREATE_EXPENSE") {
          return false;
        }
        if (actionFilter === "deletions" && log.action !== "DELETE_ENTRY" && log.action !== "DELETE_EXPENSE") {
          return false;
        }
        if (actionFilter === "sales" && !log.entity_type.includes("sale")) {
          return false;
        }
        if (actionFilter === "expenses" && !log.entity_type.includes("expense")) {
          return false;
        }
      }

      // Date filter
      if (dateFilter === "today" && log.ist_date !== todayIst) {
        return false;
      }
      if (dateFilter === "yesterday" && log.ist_date !== yesterdayIst) {
        return false;
      }
      if (dateFilter === "7days") {
        const logEpoch = new Date(log.timestamp).getTime();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (logEpoch < weekAgo) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSummary = (log.summary || "").toLowerCase().includes(q);
        const matchesActor = (log.actor_name || "").toLowerCase().includes(q);
        const matchesEntity = (log.entity_id || "").toLowerCase().includes(q);
        const matchesDiff = log.changes
          ? JSON.stringify(log.changes).toLowerCase().includes(q)
          : false;

        if (!matchesSummary && !matchesActor && !matchesEntity && !matchesDiff) {
          return false;
        }
      }

      return true;
    });
  }, [logs, staffFilter, actionFilter, dateFilter, searchQuery, todayIst, yesterdayIst]);

  // Summary counts
  const counts = useMemo(() => {
    let aminCount = 0;
    let editCount = 0;
    let deleteCount = 0;
    let createCount = 0;

    logs.forEach((l) => {
      const a = (l.actor_name || "").toLowerCase();
      const e = (l.actor_email || "").toLowerCase();
      if (a.includes("amin") || e.includes("amin") || e.includes("work.suhail007")) aminCount++;
      if (l.action === "UPDATE_ENTRY" || l.action === "UPDATE_EXPENSE") editCount++;
      if (l.action === "DELETE_ENTRY" || l.action === "DELETE_EXPENSE") deleteCount++;
      if (l.action === "CREATE_ENTRY" || l.action === "CREATE_EXPENSE") createCount++;
    });

    return { total: logs.length, aminCount, editCount, deleteCount, createCount };
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-4xl w-full text-slate-200 shadow-2xl space-y-4 my-4 max-h-[94vh] flex flex-col font-mono overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 pb-3 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-emerald-400 text-2xl">
                history_edu
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                Staff Activity &amp; Audit Trail
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider">
                Super Admin Monitor
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live, immutable chronological audit of all modifications, additions, and deletions by Mohd Amin and counter staff.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 disabled:opacity-50"
              title="Refresh logs"
            >
              <span className={`material-symbols-outlined text-base ${loading ? "animate-spin" : ""}`}>
                sync
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700"
              title="Close modal"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Metrics */}
        <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total Actions</span>
            <span className="text-lg font-bold text-white">{counts.total}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col">
            <span className="text-[10px] text-amber-400/90 uppercase tracking-wider">Mohd Amin Activity</span>
            <span className="text-lg font-bold text-amber-300">{counts.aminCount}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-amber-950/30 border border-amber-600/40 flex flex-col">
            <span className="text-[10px] text-amber-400 uppercase tracking-wider">Modifications (Edits)</span>
            <span className="text-lg font-bold text-amber-400">{counts.editCount}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-rose-950/30 border border-rose-600/40 flex flex-col">
            <span className="text-[10px] text-rose-400 uppercase tracking-wider">Deletions</span>
            <span className="text-lg font-bold text-rose-400">{counts.deleteCount}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-emerald-950/30 border border-emerald-600/40 flex flex-col">
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider">New Additions</span>
            <span className="text-lg font-bold text-emerald-400">{counts.createCount}</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-4 sm:px-6 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Search by customer, note, diff, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>

            {/* Staff Pill Selector */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setStaffFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  staffFilter === "all" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                All Staff
              </button>
              <button
                type="button"
                onClick={() => setStaffFilter("amin")}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  staffFilter === "amin" ? "bg-amber-500 text-slate-950 font-bold" : "text-amber-400 hover:text-amber-300"
                }`}
              >
                <span>👤</span> Mohd Amin
              </button>
              <button
                type="button"
                onClick={() => setStaffFilter("suhail")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  staffFilter === "suhail" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                👑 Suhail
              </button>
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Actions</option>
              <option value="modifications">✏️ Modifications (Edits)</option>
              <option value="additions">➕ Additions</option>
              <option value="deletions">🗑️ Deletions</option>
              <option value="sales">🐟 Sales Only</option>
              <option value="expenses">💸 Expenses Only</option>
            </select>

            {/* Date Quick Filter */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setDateFilter("all")}
                className={`px-2 py-1 rounded-lg transition-all ${
                  dateFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("today")}
                className={`px-2 py-1 rounded-lg transition-all ${
                  dateFilter === "today" ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("yesterday")}
                className={`px-2 py-1 rounded-lg transition-all ${
                  dateFilter === "yesterday" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("7days")}
                className={`px-2 py-1 rounded-lg transition-all ${
                  dateFilter === "7days" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                7 Days
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Timeline Activity Feed */}
        <div className="px-4 sm:px-6 pb-6 overflow-y-auto flex-1 space-y-3">
          {loading && logs.length === 0 ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl animate-spin text-emerald-400">
                progress_activity
              </span>
              <span>Loading staff audit history...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-400 bg-rose-950/20 border border-rose-800/40 rounded-2xl p-4">
              <span className="material-symbols-outlined text-3xl block mb-1">warning</span>
              {error}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 bg-slate-950/40 border border-slate-850 rounded-2xl p-6">
              <span className="material-symbols-outlined text-4xl block mb-2 text-slate-600">
                assignment_turned_in
              </span>
              <p className="text-sm font-bold text-slate-400">No activity records match your filter</p>
              <p className="text-xs text-slate-600 mt-1">
                Try switching filters to &quot;All Staff&quot; or clearing your search query.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isAmin =
                (log.actor_name || "").toLowerCase().includes("amin") ||
                (log.actor_email || "").toLowerCase().includes("work.suhail007");
              const isEdit = log.action === "UPDATE_ENTRY" || log.action === "UPDATE_EXPENSE";
              const isDelete = log.action === "DELETE_ENTRY" || log.action === "DELETE_EXPENSE";
              const isCreate = log.action === "CREATE_ENTRY" || log.action === "CREATE_EXPENSE";

              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className={`rounded-2xl border transition-all p-3.5 sm:p-4 ${
                    isDelete
                      ? "bg-rose-950/15 border-rose-800/40 hover:border-rose-700/60"
                      : isEdit
                      ? "bg-amber-950/15 border-amber-700/40 hover:border-amber-600/60"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Card Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/60 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Action Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          isDelete
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : isEdit
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[11px]">
                          {isDelete ? "delete" : isEdit ? "edit_note" : "add_circle"}
                        </span>
                        {log.action.replace("_", " ")}
                      </span>

                      {/* Actor Pill */}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                          isAmin
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                        title={log.actor_email}
                      >
                        <span>{isAmin ? "👤" : "👑"}</span>
                        <span>{log.actor_name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({log.actor_email || log.actor_role})
                        </span>
                      </span>
                    </div>

                    {/* IST Timestamp */}
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <span className="material-symbols-outlined text-[13px] text-slate-500">
                        schedule
                      </span>
                      <span className="text-white font-bold">{log.ist_date}</span>
                      <span>at</span>
                      <span className="text-emerald-300 font-bold">{log.ist_time}</span>
                    </div>
                  </div>

                  {/* Summary Row */}
                  <div className="pt-2 text-xs text-slate-200 font-sans leading-relaxed">
                    {log.summary}
                  </div>

                  {/* Visual Diff Box for Modifications */}
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/20 text-xs space-y-1.5">
                      <div className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">difference</span>
                        Detailed Values Modified:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11.5px]">
                        {Object.entries(log.changes).map(([field, diff]) => (
                          <div
                            key={field}
                            className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <span className="text-slate-400 text-[10.5px] uppercase">
                              {field.replace("_", " ")}:
                            </span>
                            <div className="flex items-center gap-1.5 text-right font-bold">
                              <span className="text-rose-400 line-through opacity-85">
                                {String(diff.from ?? "None")}
                              </span>
                              <span className="text-slate-500">➔</span>
                              <span className="text-emerald-300">
                                {String(diff.to ?? "None")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Snapshot Accordion for Deletions or Full Inspect */}
                  {(log.previous_snapshot || log.new_snapshot) && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-[11px] text-slate-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-xs">
                          {isExpanded ? "expand_less" : "expand_more"}
                        </span>
                        {isExpanded
                          ? "Hide raw entry snapshot"
                          : isDelete
                          ? "Inspect deleted record snapshot"
                          : "Inspect raw record details"}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto text-[11px] text-slate-300 space-y-1">
                          {log.previous_snapshot && (
                            <div>
                              <span className="text-rose-400 font-bold block text-[10px] uppercase">
                                Previous State Before Action:
                              </span>
                              <pre className="text-[10px] text-slate-400 whitespace-pre-wrap overflow-x-auto">
                                {JSON.stringify(log.previous_snapshot, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_snapshot && (
                            <div className="pt-2 border-t border-slate-850">
                              <span className="text-emerald-400 font-bold block text-[10px] uppercase">
                                Resulting State After Action:
                              </span>
                              <pre className="text-[10px] text-slate-400 whitespace-pre-wrap overflow-x-auto">
                                {JSON.stringify(log.new_snapshot, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
