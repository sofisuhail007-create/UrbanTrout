"use client";

import React from "react";

interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  themeColor?: "cyan" | "emerald" | "sky";
  className?: string;
}

export default function PaginationBar({
  currentPage,
  totalItems,
  pageSize = 50,
  onPageChange,
  itemLabel = "entries",
  themeColor = "cyan",
  className = "",
}: PaginationBarProps) {
  if (totalItems <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, totalItems);

  // Active theme styles
  const activeBg =
    themeColor === "emerald"
      ? "bg-emerald-500 text-slate-950 shadow-emerald-500/25 border-emerald-400"
      : themeColor === "sky"
      ? "bg-sky-500 text-slate-950 shadow-sky-500/25 border-sky-400"
      : "bg-cyan-500 text-slate-950 shadow-cyan-500/25 border-cyan-400";

  const activeText =
    themeColor === "emerald"
      ? "text-emerald-400"
      : themeColor === "sky"
      ? "text-sky-400"
      : "text-cyan-400";

  // Build page numbers window
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);

    if (safePage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (safePage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-950/70 border-t border-slate-800/80 text-xs font-mono select-none ${className}`}
    >
      {/* Entries Info */}
      <div className="flex items-center gap-2 text-slate-400">
        <span>
          Showing{" "}
          <span className={`font-bold ${activeText}`}>
            {startIdx.toLocaleString("en-IN")}
          </span>{" "}
          –{" "}
          <span className={`font-bold ${activeText}`}>
            {endIdx.toLocaleString("en-IN")}
          </span>{" "}
          of{" "}
          <span className="font-bold text-white">
            {totalItems.toLocaleString("en-IN")}
          </span>{" "}
          {itemLabel}
        </span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-500">
          50 / page
        </span>
      </div>

      {/* Navigation Controls (only render buttons if more than 1 page) */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer text-xs"
            title="Previous 50 entries"
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Page numbers (Desktop / Tablet) */}
          <div className="hidden sm:flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1 text-slate-600 font-bold"
                  >
                    ...
                  </span>
                );
              }
              const isCurrent = p === safePage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => onPageChange(p as number)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg font-bold transition-all text-xs flex items-center justify-center border cursor-pointer ${
                    isCurrent
                      ? `${activeBg} shadow-sm`
                      : "bg-slate-900 border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Compact Page Indicator (Mobile) */}
          <span className="sm:hidden px-2.5 py-1 text-[11px] font-bold text-slate-300 bg-slate-900 rounded-lg border border-slate-800">
            {safePage} / {totalPages}
          </span>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer text-xs"
            title="Next 50 entries"
          >
            <span className="hidden sm:inline">Next</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}
