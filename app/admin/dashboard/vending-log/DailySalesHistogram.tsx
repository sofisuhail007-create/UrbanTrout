"use client";

import React, { useState, useMemo } from "react";
import { VendingSalesEntry } from "@/app/api/vending-log/route";
import {
  formatIstDateDisplay,
  formatKg,
  formatMonthDisplay,
  getPreviousMonthKey,
  getNextMonthKey,
  getIstTodayDate,
} from "./page";

interface DailySalesHistogramProps {
  entries: VendingSalesEntry[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  onFilterToDate: (dateStr: string) => void;
  availableMonths: { key: string; displayLabel: string }[];
  onClose?: () => void;
}

type MetricMode = "revenue" | "weight" | "orders";

interface DayAggregate {
  dateStr: string; // YYYY-MM-DD
  dayNum: number; // 1..31
  dayOfWeek: string; // Sun, Mon...
  fullLabel: string; // "04 Oct (Sun)"
  revenue: number;
  weightKg: number;
  guttedKg: number;
  nonGuttedKg: number;
  ordersCount: number;
  onlineRevenue: number;
  cashRevenue: number;
  maxSingleOrder: number;
}

export default function DailySalesHistogram({
  entries,
  selectedMonth,
  onSelectMonth,
  onFilterToDate,
  availableMonths,
  onClose,
}: DailySalesHistogramProps) {
  const [metricMode, setMetricMode] = useState<MetricMode>("revenue");
  const [showAllMonthDays, setShowAllMonthDays] = useState<boolean>(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Parse Year and Month
  const [yearNum, monthNum] = useMemo(() => {
    const parts = (selectedMonth || getIstTodayDate().slice(0, 7)).split("-").map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [selectedMonth]);

  // Total days in the selected month
  const daysInMonth = useMemo(() => {
    return new Date(yearNum, monthNum, 0).getDate();
  }, [yearNum, monthNum]);

  // Aggregate daily data for the selected month
  const { dailyData, peakDay, monthTotals } = useMemo<{
    dailyData: DayAggregate[];
    peakDay: DayAggregate | null;
    monthTotals: {
      revenue: number;
      weightKg: number;
      orders: number;
      online: number;
      cash: number;
      activeDays: number;
    };
  }>(() => {
    const map: Record<string, DayAggregate> = {};

    // Filter entries belonging to this month
    const monthPrefix = `${yearNum}-${String(monthNum).padStart(2, "0")}`;

    entries.forEach((e) => {
      if (!e.entry_date || !e.entry_date.startsWith(monthPrefix)) return;
      const dStr = e.entry_date;

      if (!map[dStr]) {
        const parts = dStr.split("-").map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayOfWeek = dt.toLocaleDateString("en-IN", { weekday: "short" });
        const dayNum = parts[2];
        const dayMonthStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

        map[dStr] = {
          dateStr: dStr,
          dayNum,
          dayOfWeek,
          fullLabel: `${dayMonthStr} (${dayOfWeek})`,
          revenue: 0,
          weightKg: 0,
          guttedKg: 0,
          nonGuttedKg: 0,
          ordersCount: 0,
          onlineRevenue: 0,
          cashRevenue: 0,
          maxSingleOrder: 0,
        };
      }

      const rev = Number(e.amount_paid) || 0;
      const wt = Number(e.weight_kg) || 0;
      const payMethod = ((e as any).payment_mode || (e as any).payment_method || "").toLowerCase();
      const prodType = (e.product_type || "").toLowerCase();
      const isGutted = prodType.includes("gutted") && !prodType.includes("non");

      map[dStr].revenue += rev;
      map[dStr].weightKg = Math.round((map[dStr].weightKg + wt) * 1000) / 1000;
      if (isGutted) {
        map[dStr].guttedKg = Math.round((map[dStr].guttedKg + wt) * 1000) / 1000;
      } else {
        map[dStr].nonGuttedKg = Math.round((map[dStr].nonGuttedKg + wt) * 1000) / 1000;
      }
      map[dStr].ordersCount += 1;

      if (payMethod.includes("upi") || payMethod.includes("razorpay") || payMethod.includes("card") || payMethod.includes("online")) {
        map[dStr].onlineRevenue += rev;
      } else {
        map[dStr].cashRevenue += rev;
      }

      if (rev > map[dStr].maxSingleOrder) {
        map[dStr].maxSingleOrder = rev;
      }
    });

    let list: DayAggregate[] = [];

    if (showAllMonthDays) {
      // Create entries for days 1 to daysInMonth
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (map[dStr]) {
          list.push(map[dStr]);
        } else {
          const dt = new Date(yearNum, monthNum - 1, day);
          const dayOfWeek = dt.toLocaleDateString("en-IN", { weekday: "short" });
          const dayMonthStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          list.push({
            dateStr: dStr,
            dayNum: day,
            dayOfWeek,
            fullLabel: `${dayMonthStr} (${dayOfWeek})`,
            revenue: 0,
            weightKg: 0,
            guttedKg: 0,
            nonGuttedKg: 0,
            ordersCount: 0,
            onlineRevenue: 0,
            cashRevenue: 0,
            maxSingleOrder: 0,
          });
        }
      }
    } else {
      // Only active days sorted by date ascending
      list = Object.values(map).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }

    // Totals & Peak
    let totalRev = 0;
    let totalWt = 0;
    let totalOrders = 0;
    let totalOnline = 0;
    let totalCash = 0;
    let peakDayItem: DayAggregate | null = null;
    let maxMetricVal = -1;

    list.forEach((day) => {
      totalRev += day.revenue;
      totalWt += day.weightKg;
      totalOrders += day.ordersCount;
      totalOnline += day.onlineRevenue;
      totalCash += day.cashRevenue;

      const compareVal = metricMode === "revenue" ? day.revenue : metricMode === "weight" ? day.weightKg : day.ordersCount;
      if (compareVal > maxMetricVal && day.ordersCount > 0) {
        maxMetricVal = compareVal;
        peakDayItem = day;
      }
    });

    return {
      dailyData: list,
      peakDay: peakDayItem,
      monthTotals: {
        revenue: totalRev,
        weightKg: Math.round(totalWt * 1000) / 1000,
        orders: totalOrders,
        online: totalOnline,
        cash: totalCash,
        activeDays: list.filter((d) => d.ordersCount > 0).length,
      },
    };
  }, [entries, yearNum, monthNum, daysInMonth, showAllMonthDays, metricMode]);

  // Default selected day to Peak Day or the latest active day
  const activeDay = useMemo(() => {
    if (selectedDate) {
      const found = dailyData.find((d) => d.dateStr === selectedDate);
      if (found) return found;
    }
    return peakDay || dailyData[dailyData.length - 1] || null;
  }, [selectedDate, dailyData, peakDay]);

  // Max value for scaling chart bars
  const maxValue = useMemo(() => {
    let max = 0;
    dailyData.forEach((d) => {
      const val = metricMode === "revenue" ? d.revenue : metricMode === "weight" ? d.weightKg : d.ordersCount;
      if (val > max) max = val;
    });
    return max > 0 ? max : 1;
  }, [dailyData, metricMode]);

  // SVG Chart dimensions
  const chartHeight = 240;
  const paddingL = 55;
  const paddingR = 20;
  const paddingT = 30;
  const paddingB = 45;
  const effectiveHeight = chartHeight - paddingT - paddingB;

  // Grid steps (4 lines)
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-gradient-to-b from-[#0a1322] to-slate-950 border-2 border-emerald-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-emerald-950/30 overflow-hidden relative mb-4">
      {/* ─── Top Header & Controls ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-4">
        {/* Title & Month Selector */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
            <span className="material-symbols-outlined text-xl">bar_chart</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
                <span>Everyday Sales Histogram</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Month-Wise
                </span>
              </h3>
            </div>
            <p className="text-slate-400 text-xs font-mono">
              Day-by-day revenue, volume &amp; peak performance for{" "}
              <span className="text-emerald-300 font-bold">{formatMonthDisplay(selectedMonth)}</span>
            </p>
          </div>
        </div>

        {/* Month Selector Pills + Metric Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Navigator */}
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5 shadow-sm text-xs font-mono">
            <button
              type="button"
              onClick={() => onSelectMonth(getPreviousMonthKey(selectedMonth))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="Previous Month"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <select
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="bg-transparent text-emerald-300 font-bold px-2 py-1 text-xs focus:outline-none cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                  {m.displayLabel}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onSelectMonth(getNextMonthKey(selectedMonth))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="Next Month"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>

          {/* Metric Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5 shadow-sm text-xs font-mono">
            <button
              type="button"
              onClick={() => setMetricMode("revenue")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                metricMode === "revenue"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <span>₹ Revenue</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("weight")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                metricMode === "weight"
                  ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <span>⚖️ Weight (Kg)</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode("orders")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                metricMode === "orders"
                  ? "bg-amber-400 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <span>🧾 Orders</span>
            </button>
          </div>

          {/* Day View Toggle: Active Days vs All Calendar Days */}
          <button
            type="button"
            onClick={() => setShowAllMonthDays((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 text-[11px] font-mono text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            title="Toggle between showing only active sales days or all 30/31 days of the month"
          >
            <span className="material-symbols-outlined text-xs">
              {showAllMonthDays ? "filter_list" : "calendar_view_month"}
            </span>
            <span className="hidden sm:inline">
              {showAllMonthDays ? "Active Days Only" : "All Calendar Days"}
            </span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="Close Histogram"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Month Summary KPI Pills (Flashcard Style) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
        {/* Flashcard 1: Peak Sales Day */}
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center text-lg flex-shrink-0">
            🏆
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-amber-300/80 font-bold uppercase tracking-wider truncate">
              Peak Day Record
            </div>
            {peakDay ? (
              <div>
                <div className="text-white font-extrabold text-sm truncate font-mono">
                  {peakDay.fullLabel}
                </div>
                <div className="text-amber-300 text-xs font-mono font-bold">
                  ₹{peakDay.revenue.toLocaleString("en-IN")}{" "}
                  <span className="text-[10px] text-amber-200/80">({formatKg(peakDay.weightKg)} Kg)</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-xs font-mono">No Sales Logged</div>
            )}
          </div>
        </div>

        {/* Flashcard 2: Total Month Revenue */}
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-lg flex-shrink-0">
            💰
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-emerald-300/80 font-bold uppercase tracking-wider truncate">
              Month Revenue
            </div>
            <div className="text-white font-extrabold text-sm truncate font-mono">
              ₹{monthTotals.revenue.toLocaleString("en-IN")}
            </div>
            <div className="text-emerald-400 text-[10px] font-mono">
              {monthTotals.activeDays} active sales days
            </div>
          </div>
        </div>

        {/* Flashcard 3: Total Weight Sold */}
        <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-lg flex-shrink-0">
            ⚖️
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-cyan-300/80 font-bold uppercase tracking-wider truncate">
              Total Weight Sold
            </div>
            <div className="text-white font-extrabold text-sm truncate font-mono">
              {formatKg(monthTotals.weightKg)} Kg
            </div>
            <div className="text-cyan-400 text-[10px] font-mono truncate">
              Live harvested trout
            </div>
          </div>
        </div>

        {/* Flashcard 4: Daily Average */}
        <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-3 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center text-lg flex-shrink-0">
            📈
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-purple-300/80 font-bold uppercase tracking-wider truncate">
              Daily Average
            </div>
            <div className="text-white font-extrabold text-sm truncate font-mono">
              ₹
              {monthTotals.activeDays > 0
                ? Math.round(monthTotals.revenue / monthTotals.activeDays).toLocaleString("en-IN")
                : 0}
              <span className="text-[10px] text-slate-400">/day</span>
            </div>
            <div className="text-purple-400 text-[10px] font-mono">
              {monthTotals.activeDays > 0
                ? (monthTotals.weightKg / monthTotals.activeDays).toFixed(2)
                : 0}{" "}
              Kg/day
            </div>
          </div>
        </div>

        {/* Flashcard 5: Orders & Online Ratio */}
        <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-3 relative overflow-hidden col-span-2 sm:col-span-1">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center text-lg flex-shrink-0">
            🧾
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-blue-300/80 font-bold uppercase tracking-wider truncate">
              Total Orders
            </div>
            <div className="text-white font-extrabold text-sm truncate font-mono">
              {monthTotals.orders} Bills
            </div>
            <div className="text-blue-300 text-[10px] font-mono truncate">
              Online: ₹{monthTotals.online.toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </div>

      {/* ─── The Histogram (SVG Bar Chart) ─── */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 sm:p-4 relative">
        {dailyData.length === 0 ? (
          <div className="py-16 text-center text-slate-500 font-mono text-sm">
            <span className="material-symbols-outlined text-4xl mb-2 text-slate-600 block">
              signal_cellular_nodata
            </span>
            No sales data recorded for {formatMonthDisplay(selectedMonth)}.
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <svg
              className="w-full"
              style={{ minWidth: dailyData.length > 15 ? `${dailyData.length * 36}px` : "100%" }}
              height={chartHeight}
              viewBox={`0 0 ${Math.max(600, dailyData.length * 40 + paddingL + paddingR)} ${chartHeight}`}
            >
              <defs>
                {/* Standard Emerald Gradient */}
                <linearGradient id="barGradEmerald" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
                </linearGradient>

                {/* Peak Day Gold/Amber Gradient */}
                <linearGradient id="barGradPeak" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="1" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.9" />
                </linearGradient>

                {/* Cyan Gradient for Weight */}
                <linearGradient id="barGradCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.8" />
                </linearGradient>

                {/* Purple Gradient for Orders */}
                <linearGradient id="barGradOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity="1" />
                  <stop offset="100%" stopColor="#7e22ce" stopOpacity="0.8" />
                </linearGradient>

                {/* Glow Filter for Peak Day */}
                <filter id="peakGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Grid Lines & Y-Axis Labels */}
              {gridSteps.map((ratio, idx) => {
                const y = paddingT + (1 - ratio) * effectiveHeight;
                const val = ratio * maxValue;
                let label = "";
                if (metricMode === "revenue") {
                  label = val >= 1000 ? `₹${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : `₹${Math.round(val)}`;
                } else if (metricMode === "weight") {
                  label = `${val.toFixed(val >= 10 ? 0 : 1)}k`;
                } else {
                  label = `${Math.round(val)}`;
                }

                return (
                  <g key={idx}>
                    <line
                      x1={paddingL}
                      y1={y}
                      x2="98%"
                      y2={y}
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeDasharray={idx === 0 ? undefined : "3 3"}
                    />
                    <text
                      x={paddingL - 8}
                      y={y + 4}
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Render Bars */}
              {(() => {
                const totalSvgWidth = Math.max(600, dailyData.length * 40 + paddingL + paddingR);
                const chartWidth = totalSvgWidth - paddingL - paddingR;
                const slotWidth = chartWidth / dailyData.length;
                const barWidth = Math.min(32, Math.max(14, slotWidth - 8));

                return dailyData.map((d, i) => {
                  const val = metricMode === "revenue" ? d.revenue : metricMode === "weight" ? d.weightKg : d.ordersCount;
                  const barHeight = maxValue > 0 ? (val / maxValue) * effectiveHeight : 0;
                  const x = paddingL + i * slotWidth + (slotWidth - barWidth) / 2;
                  const y = paddingT + effectiveHeight - barHeight;
                  const isPeak = peakDay && d.dateStr === peakDay.dateStr && val > 0;
                  const isSelected = activeDay && d.dateStr === activeDay.dateStr;
                  const isHovered = hoveredDate === d.dateStr;

                  let fillGrad = "url(#barGradEmerald)";
                  if (isPeak) fillGrad = "url(#barGradPeak)";
                  else if (metricMode === "weight") fillGrad = "url(#barGradCyan)";
                  else if (metricMode === "orders") fillGrad = "url(#barGradOrders)";

                  return (
                    <g
                      key={d.dateStr}
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredDate(d.dateStr)}
                      onMouseLeave={() => setHoveredDate(null)}
                      onClick={() => setSelectedDate(d.dateStr)}
                    >
                      {/* Zero day faint pill */}
                      {val === 0 && (
                        <rect
                          x={x}
                          y={paddingT + effectiveHeight - 4}
                          width={barWidth}
                          height={4}
                          rx={2}
                          fill="rgba(255, 255, 255, 0.15)"
                        />
                      )}

                      {/* Main Bar */}
                      {val > 0 && (
                        <g>
                          {/* Highlight Glow for selected or peak */}
                          {(isSelected || isHovered) && (
                            <rect
                              x={x - 2}
                              y={y - 2}
                              width={barWidth + 4}
                              height={barHeight + 4}
                              rx={7}
                              fill="none"
                              stroke={isPeak ? "#f59e0b" : "#34d399"}
                              strokeWidth="2"
                              opacity={isSelected ? "1" : "0.7"}
                            />
                          )}

                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={Math.max(4, barHeight)}
                            rx={5}
                            fill={fillGrad}
                            filter={isPeak ? "url(#peakGlow)" : undefined}
                            opacity={isSelected || isHovered ? 1 : 0.9}
                          />

                          {/* Peak Day Crown Badge on top of Bar */}
                          {isPeak && (
                            <g transform={`translate(${x + barWidth / 2}, ${y - 12})`}>
                              <circle r="9" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
                              <text
                                textAnchor="middle"
                                y="3.5"
                                fontSize="9"
                                fill="#ffffff"
                                fontWeight="bold"
                              >
                                👑
                              </text>
                            </g>
                          )}
                        </g>
                      )}

                      {/* X-Axis Date Label */}
                      <text
                        x={x + barWidth / 2}
                        y={paddingT + effectiveHeight + 15}
                        fill={isSelected ? "#34d399" : isPeak ? "#fbbf24" : "#94a3b8"}
                        fontSize="10"
                        fontWeight={isSelected || isPeak ? "bold" : "normal"}
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {String(d.dayNum).padStart(2, "0")}
                      </text>

                      {/* Weekday abbreviation */}
                      <text
                        x={x + barWidth / 2}
                        y={paddingT + effectiveHeight + 28}
                        fill="#64748b"
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {d.dayOfWeek}
                      </text>
                    </g>
                  );
                });
              })()}
            </svg>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2 px-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span>
              <span className="text-amber-300 font-bold">Peak Sales Day</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
              <span>Daily Sales</span>
            </span>
          </div>
          <div className="text-slate-400 text-[11px]">
            💡 <span className="text-slate-300">Tap any bar</span> to open full day flashcards below
          </div>
        </div>
      </div>

      {/* ─── Detailed Day Flashcards (Interactive Details on Click) ─── */}
      {activeDay && (
        <div className="mt-4 bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">event_available</span>
              <span className="text-white font-bold text-sm font-mono">
                Detailed Information: {activeDay.fullLabel}
              </span>
              {peakDay && activeDay.dateStr === peakDay.dateStr && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                  <span>👑 Peak Day of the Month</span>
                </span>
              )}
            </div>

            {/* Quick Action: Filter Table to this Day */}
            <button
              type="button"
              onClick={() => onFilterToDate(activeDay.dateStr)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
              title={`Filter main ledger to show only bills from ${activeDay.dateStr}`}
            >
              <span className="material-symbols-outlined text-sm">filter_alt</span>
              <span>View All Bills From This Day</span>
            </button>
          </div>

          {/* 4 Interactive Flashcards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Revenue Breakdown */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span className="font-bold text-emerald-400 uppercase tracking-wider">💰 Day Revenue</span>
                <span className="text-[10px] text-slate-400">
                  {monthTotals.revenue > 0
                    ? `${((activeDay.revenue / monthTotals.revenue) * 100).toFixed(1)}% of Month`
                    : "0%"}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono my-1">
                ₹{activeDay.revenue.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] font-mono space-y-1 pt-1 border-t border-slate-800 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-blue-300">💳 Online / UPI:</span>
                  <span className="font-bold text-white">₹{activeDay.onlineRevenue.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-300">💵 Cash Counter:</span>
                  <span className="font-bold text-white">₹{activeDay.cashRevenue.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Biomass & Weight Breakdown */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span className="font-bold text-cyan-400 uppercase tracking-wider">⚖️ Weight Sold</span>
                <span className="text-[10px] text-slate-400">
                  {monthTotals.weightKg > 0
                    ? `${((activeDay.weightKg / monthTotals.weightKg) * 100).toFixed(1)}% of Month`
                    : "0%"}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono my-1">
                {formatKg(activeDay.weightKg)} <span className="text-sm font-normal text-slate-400">Kg</span>
              </div>
              <div className="text-[11px] font-mono space-y-1 pt-1 border-t border-slate-800 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-cyan-300">🔪 Cleaned &amp; Gutted:</span>
                  <span className="font-bold text-white">{formatKg(activeDay.guttedKg)} Kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">🐟 Whole / Non-Gutted:</span>
                  <span className="font-bold text-white">{formatKg(activeDay.nonGuttedKg)} Kg</span>
                </div>
              </div>
            </div>

            {/* Card 3: Orders & AOV */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span className="font-bold text-amber-400 uppercase tracking-wider">🧾 Transaction Volume</span>
                <span className="text-[10px] text-slate-400">{activeDay.ordersCount} Bills Total</span>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono my-1">
                {activeDay.ordersCount}{" "}
                <span className="text-sm font-normal text-slate-400">Dispatches</span>
              </div>
              <div className="text-[11px] font-mono space-y-1 pt-1 border-t border-slate-800 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Order Value:</span>
                  <span className="font-bold text-white">
                    ₹{activeDay.ordersCount > 0 ? Math.round(activeDay.revenue / activeDay.ordersCount) : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Weight / Bill:</span>
                  <span className="font-bold text-white">
                    {activeDay.ordersCount > 0 ? (activeDay.weightKg / activeDay.ordersCount).toFixed(2) : 0} Kg
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Top Single Sale & Highlights */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                <span className="font-bold text-purple-400 uppercase tracking-wider">⭐ Day Highlights</span>
                <span className="text-[10px] text-purple-300 font-bold font-mono">
                  {activeDay.revenue >= 10000 ? "🔥 Super Hit Day" : activeDay.revenue >= 5000 ? "⚡ Strong Sales" : "Steady Day"}
                </span>
              </div>
              <div className="text-base sm:text-lg font-bold text-white font-mono my-1">
                Max Sale:{" "}
                <span className="text-emerald-400 font-extrabold">
                  ₹{activeDay.maxSingleOrder.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-[11px] font-mono pt-1 border-t border-slate-800 text-slate-400">
                Click below to drill down into the customer names, weight slips &amp; live receipt logs.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
