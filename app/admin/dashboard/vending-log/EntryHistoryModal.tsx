"use client";

import React from "react";
import { VendingSalesEntry } from "@/app/api/vending-log/route";

interface EntryHistoryModalProps {
  entry: VendingSalesEntry | null;
  onClose: () => void;
}

export default function EntryHistoryModal({ entry, onClose }: EntryHistoryModalProps) {
  if (!entry) return null;

  const history = Array.isArray(entry.custom_fields?.edit_history)
    ? entry.custom_fields.edit_history
    : [];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="bg-slate-900 border border-sky-500/40 rounded-3xl max-w-xl w-full text-slate-200 shadow-2xl space-y-4 my-4 max-h-[90vh] flex flex-col font-mono overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-400 text-xl">manage_history</span>
              <h3 className="text-base font-bold text-white tracking-wide">
                Sales Entry Provenance &amp; History
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Entry #{entry.id.slice(0, 8)} &bull; {entry.entry_date} at {entry.entry_time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Current Entry Snapshot */}
        <div className="px-4 sm:px-5">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Weight</span>
              <span className="text-white font-bold">{entry.weight_kg} Kg</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Rate</span>
              <span className="text-white font-bold">₹{entry.rate_per_kg}/Kg</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Collected</span>
              <span className="text-emerald-400 font-bold">₹{entry.amount_paid}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Created By</span>
              <span className="text-sky-300 font-bold">{entry.logged_by || "Staff"}</span>
            </div>
          </div>
        </div>

        {/* Audit History Timeline */}
        <div className="px-4 sm:px-5 pb-5 overflow-y-auto flex-1 space-y-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs text-sky-400">timeline</span>
            Modification Log ({history.length} edit{history.length === 1 ? "" : "s"})
          </div>

          {history.length === 0 ? (
            <div className="py-8 text-center text-slate-500 bg-slate-950/40 border border-slate-850 rounded-2xl p-4">
              <span className="material-symbols-outlined text-2xl text-slate-600 block mb-1">
                verified
              </span>
              <p className="text-xs text-slate-400 font-bold">No modifications recorded</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                This entry has not been modified since it was originally logged.
              </p>
            </div>
          ) : (
            history.map((item: any, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/90 border border-amber-500/20 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-300 flex items-center gap-1">
                    <span>👤</span> {item.actor_name || "Staff"}
                    {item.actor_email && (
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({item.actor_email})
                      </span>
                    )}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {item.ist_date || ""} at {item.ist_time || ""}
                  </span>
                </div>

                <div className="text-slate-300 font-sans text-xs">{item.summary}</div>

                {item.changes && Object.keys(item.changes).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                    {Object.entries(item.changes).map(([k, diff]: any) => (
                      <div
                        key={k}
                        className="p-1 rounded bg-slate-900 border border-slate-800 flex items-center justify-between px-2"
                      >
                        <span className="text-slate-400 text-[10px] uppercase">{k}:</span>
                        <div className="flex items-center gap-1 font-bold">
                          <span className="text-rose-400 line-through text-[10px]">
                            {String(diff.from ?? "")}
                          </span>
                          <span className="text-slate-600">➔</span>
                          <span className="text-emerald-300 text-[10px]">
                            {String(diff.to ?? "")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
