"use client";

import React, { useState, useMemo, useRef } from "react";
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
  surplusInfoMap?: Map<string, { regularKg: number; surplusKg: number; isSurplus: boolean; isPureSurplus?: boolean }>;
  isAdmin?: boolean;
  onClose?: () => void;
}

type MetricMode = "revenue" | "weight" | "orders";
type ChartViewType = "bars" | "cumulative" | "weekday";

interface DayAggregate {
  dateStr: string; // YYYY-MM-DD
  dayNum: number; // 1..31
  dayOfWeek: string; // Sun, Mon...
  dayOfWeekFull: string;
  fullLabel: string; // "04 Oct (Sun)"
  revenue: number;
  weightKg: number;
  guttedKg: number;
  nonGuttedKg: number;
  surplusKg: number;
  ordersCount: number;
  onlineRevenue: number;
  cashRevenue: number;
  maxSingleOrder: number;
  isWeekend: boolean; // Fri, Sat, Sun in Kashmir retail context
}

interface WeekdayAggregate {
  dayName: string; // "Sun", "Mon"...
  fullName: string;
  totalRevenue: number;
  totalWeightKg: number;
  totalOrders: number;
  daysCount: number;
  avgRevenue: number;
  avgWeightKg: number;
}

export default function DailySalesHistogram({
  entries,
  selectedMonth,
  onSelectMonth,
  onFilterToDate,
  availableMonths,
  surplusInfoMap,
  isAdmin = false,
  onClose,
}: DailySalesHistogramProps) {
  if (!isAdmin) return null;

  // View state
  const [metricMode, setMetricMode] = useState<MetricMode>("revenue");
  const [chartView, setChartView] = useState<ChartViewType>("bars");
  const [showAllMonthDays, setShowAllMonthDays] = useState<boolean>(false);
  const [showTrendLine, setShowTrendLine] = useState<boolean>(true);
  const [hoveredDay, setHoveredDay] = useState<DayAggregate | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Parse Year and Month
  const [yearNum, monthNum] = useMemo(() => {
    const parts = (selectedMonth || getIstTodayDate().slice(0, 7)).split("-").map(Number);
    return [parts[0] || new Date().getFullYear(), parts[1] || new Date().getMonth() + 1];
  }, [selectedMonth]);

  // Total days in the selected month
  const daysInMonth = useMemo(() => {
    return new Date(yearNum, monthNum, 0).getDate();
  }, [yearNum, monthNum]);

  interface UseMemoDailyResult {
    dailyData: DayAggregate[];
    peakDay: DayAggregate | null;
    monthTotals: {
      revenue: number;
      weightKg: number;
      surplusKg: number;
      orders: number;
      online: number;
      cash: number;
      activeDays: number;
      dailyAverageRevenue: number;
      dailyAverageKg: string;
      weekendMultiplier: number;
      projectedMonthRevenue: number;
      isCurrentActiveMonth: boolean;
    };
    weekdayAverages: WeekdayAggregate[];
  }

  // ─── Daily Aggregates Computation ───
  const { dailyData, peakDay, monthTotals, weekdayAverages } = useMemo<UseMemoDailyResult>(() => {
    const map: Record<string, DayAggregate> = {};
    const monthPrefix = `${yearNum}-${String(monthNum).padStart(2, "0")}`;

    entries.forEach((e) => {
      if (!e.entry_date || !e.entry_date.startsWith(monthPrefix)) return;
      const dStr = e.entry_date;

      if (!map[dStr]) {
        const parts = dStr.split("-").map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayOfWeek = dt.toLocaleDateString("en-IN", { weekday: "short" });
        const dayOfWeekFull = dt.toLocaleDateString("en-IN", { weekday: "long" });
        const dayNum = parts[2];
        const dayMonthStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        const isWeekend = ["Fri", "Sat", "Sun"].includes(dayOfWeek);

        map[dStr] = {
          dateStr: dStr,
          dayNum,
          dayOfWeek,
          dayOfWeekFull,
          fullLabel: `${dayMonthStr} (${dayOfWeek})`,
          revenue: 0,
          weightKg: 0,
          guttedKg: 0,
          nonGuttedKg: 0,
          surplusKg: 0,
          ordersCount: 0,
          onlineRevenue: 0,
          cashRevenue: 0,
          maxSingleOrder: 0,
          isWeekend,
        };
      }

      const rev = Number(e.amount_paid) || 0;
      const wt = Number(e.weight_kg) || 0;
      const payMethod = ((e as any).payment_mode || (e as any).payment_method || "").toLowerCase();
      const prodType = (e.product_type || "").toLowerCase();
      const isGutted = prodType.includes("gutted") && !prodType.includes("non");
      const sInfo = surplusInfoMap?.get(e.id);

      map[dStr].revenue += rev;
      map[dStr].weightKg = Math.round((map[dStr].weightKg + wt) * 1000) / 1000;
      if (sInfo?.surplusKg) {
        map[dStr].surplusKg = Math.round((map[dStr].surplusKg + sInfo.surplusKg) * 1000) / 1000;
      }
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
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (map[dStr]) {
          list.push(map[dStr]);
        } else {
          const dt = new Date(yearNum, monthNum - 1, day);
          const dayOfWeek = dt.toLocaleDateString("en-IN", { weekday: "short" });
          const dayOfWeekFull = dt.toLocaleDateString("en-IN", { weekday: "long" });
          const dayMonthStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          const isWeekend = ["Fri", "Sat", "Sun"].includes(dayOfWeek);

          list.push({
            dateStr: dStr,
            dayNum: day,
            dayOfWeek,
            dayOfWeekFull,
            fullLabel: `${dayMonthStr} (${dayOfWeek})`,
            revenue: 0,
            weightKg: 0,
            guttedKg: 0,
            nonGuttedKg: 0,
            surplusKg: 0,
            ordersCount: 0,
            onlineRevenue: 0,
            cashRevenue: 0,
            maxSingleOrder: 0,
            isWeekend,
          });
        }
      }
    } else {
      list = Object.values(map).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }

    // Totals & Peak Detection
    let totalRev = 0;
    let totalWt = 0;
    let totalSurplus = 0;
    let totalOrders = 0;
    let totalOnline = 0;
    let totalCash = 0;
    let weekendRev = 0;
    let weekendDays = 0;
    let weekdayRev = 0;
    let weekdayDays = 0;
    let peakDayItem: DayAggregate | null = null;
    let maxMetricVal = -1;

    list.forEach((day) => {
      totalRev += day.revenue;
      totalWt += day.weightKg;
      totalSurplus += day.surplusKg;
      totalOrders += day.ordersCount;
      totalOnline += day.onlineRevenue;
      totalCash += day.cashRevenue;

      if (day.ordersCount > 0) {
        if (day.isWeekend) {
          weekendRev += day.revenue;
          weekendDays += 1;
        } else {
          weekdayRev += day.revenue;
          weekdayDays += 1;
        }
      }

      const compareVal = metricMode === "revenue" ? day.revenue : metricMode === "weight" ? day.weightKg : day.ordersCount;
      if (compareVal > maxMetricVal && day.ordersCount > 0) {
        maxMetricVal = compareVal;
        peakDayItem = day;
      }
    });

    const activeDaysCount = list.filter((d) => d.ordersCount > 0).length;
    const avgWeekendRev = weekendDays > 0 ? weekendRev / weekendDays : 0;
    const avgWeekdayRev = weekdayDays > 0 ? weekdayRev / weekdayDays : 0;
    const weekendMultiplier = avgWeekdayRev > 0 ? ((avgWeekendRev - avgWeekdayRev) / avgWeekdayRev) * 100 : 0;

    // Projected Month End Revenue (MTD Run-Rate)
    const currentMonthKey = getIstTodayDate().slice(0, 7);
    const isCurrentActiveMonth = selectedMonth === currentMonthKey;
    const currentDayOfMonth = new Date().getDate();
    const projectedMonthRevenue = isCurrentActiveMonth && currentDayOfMonth > 0
      ? Math.round((totalRev / currentDayOfMonth) * daysInMonth)
      : totalRev;

    // ─── Day of Week Aggregates (Sun..Sat) ───
    const weekOrder = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekMap: Record<string, { totalRev: number; totalWt: number; totalOrd: number; count: number }> = {};
    weekOrder.forEach((d) => {
      weekMap[d] = { totalRev: 0, totalWt: 0, totalOrd: 0, count: 0 };
    });

    list.forEach((d) => {
      if (d.ordersCount > 0 && weekMap[d.dayOfWeek]) {
        weekMap[d.dayOfWeek].totalRev += d.revenue;
        weekMap[d.dayOfWeek].totalWt += d.weightKg;
        weekMap[d.dayOfWeek].totalOrd += d.ordersCount;
        weekMap[d.dayOfWeek].count += 1;
      }
    });

    const fullNames: Record<string, string> = {
      Sun: "Sunday",
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
    };

    const weekdayList: WeekdayAggregate[] = weekOrder.map((dayName) => {
      const data = weekMap[dayName];
      return {
        dayName,
        fullName: fullNames[dayName] || dayName,
        totalRevenue: data.totalRev,
        totalWeightKg: Math.round(data.totalWt * 1000) / 1000,
        totalOrders: data.totalOrd,
        daysCount: data.count,
        avgRevenue: data.count > 0 ? Math.round(data.totalRev / data.count) : 0,
        avgWeightKg: data.count > 0 ? Math.round((data.totalWt / data.count) * 10) / 10 : 0,
      };
    });

    return {
      dailyData: list,
      peakDay: peakDayItem,
      monthTotals: {
        revenue: totalRev,
        weightKg: Math.round(totalWt * 1000) / 1000,
        surplusKg: Math.round(totalSurplus * 1000) / 1000,
        orders: totalOrders,
        online: totalOnline,
        cash: totalCash,
        activeDays: activeDaysCount,
        dailyAverageRevenue: activeDaysCount > 0 ? Math.round(totalRev / activeDaysCount) : 0,
        dailyAverageKg: activeDaysCount > 0 ? (totalWt / activeDaysCount).toFixed(2) : "0.00",
        weekendMultiplier: Math.round(weekendMultiplier),
        projectedMonthRevenue,
        isCurrentActiveMonth,
      },
      weekdayAverages: weekdayList,
    };
  }, [entries, yearNum, monthNum, daysInMonth, showAllMonthDays, metricMode, surplusInfoMap, selectedMonth]);

  // Selected Day for deep dive
  const activeDay = useMemo(() => {
    if (selectedDate) {
      const found = dailyData.find((d) => d.dateStr === selectedDate);
      if (found) return found;
    }
    return peakDay || dailyData[dailyData.length - 1] || null;
  }, [selectedDate, dailyData, peakDay]);

  // Max value for scaling
  const maxValue = useMemo(() => {
    if (chartView === "cumulative") {
      return monthTotals.revenue > 0 ? monthTotals.revenue : 1;
    }
    if (chartView === "weekday") {
      let maxWk = 0;
      weekdayAverages.forEach((w) => {
        const val = metricMode === "revenue" ? w.avgRevenue : metricMode === "weight" ? w.avgWeightKg : w.totalOrders;
        if (val > maxWk) maxWk = val;
      });
      return maxWk > 0 ? maxWk : 1;
    }
    let max = 0;
    dailyData.forEach((d) => {
      const val = metricMode === "revenue" ? d.revenue : metricMode === "weight" ? d.weightKg : d.ordersCount;
      if (val > max) max = val;
    });
    return max > 0 ? max : 1;
  }, [dailyData, metricMode, chartView, monthTotals.revenue, weekdayAverages]);

  // 7-Day Moving Average calculation
  const movingAverages = useMemo(() => {
    return dailyData.map((d, idx) => {
      const windowStart = Math.max(0, idx - 6);
      const windowSlice = dailyData.slice(windowStart, idx + 1);
      const sum = windowSlice.reduce((acc, curr) => {
        const val = metricMode === "revenue" ? curr.revenue : metricMode === "weight" ? curr.weightKg : curr.ordersCount;
        return acc + val;
      }, 0);
      return Math.round((sum / windowSlice.length) * 10) / 10;
    });
  }, [dailyData, metricMode]);

  // Cumulative data points
  const cumulativeData = useMemo(() => {
    let running = 0;
    return dailyData.map((d) => {
      running += d.revenue;
      return { ...d, cumulativeRevenue: running };
    });
  }, [dailyData]);

  // SVG Chart Dimensions
  const chartHeight = 260;
  const paddingL = 60;
  const paddingR = 25;
  const paddingT = 35;
  const paddingB = 45;
  const effectiveHeight = chartHeight - paddingT - paddingB;

  // Grid steps (4 horizontal guide lines)
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  // Tooltip mouse position handler
  const handleBarHover = (e: React.MouseEvent, day: DayAggregate) => {
    setHoveredDay(day);
    if (chartContainerRef.current) {
      const rect = chartContainerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  return (
    <div
      ref={chartContainerRef}
      className="bg-gradient-to-b from-[#09111e] via-[#070d17] to-slate-950 border-2 border-emerald-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-emerald-950/40 relative mb-4 font-sans overflow-hidden backdrop-blur-xl"
    >
      {/* Ambient background glow decoration */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ─── High-Tech Header & View Controls ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-4 relative z-10">
        {/* Title & Month Selector */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-lg shadow-emerald-950/40">
            <span className="material-symbols-outlined text-xl">query_stats</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-extrabold text-base sm:text-lg tracking-tight flex items-center gap-2 font-mono">
                <span>Everyday Sales Telemetry</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-mono font-black uppercase tracking-wider">
                  Live Matrix
                </span>
              </h3>
            </div>
            <p className="text-slate-400 text-xs font-mono">
              Day-by-day distribution, moving momentum &amp; volume for{" "}
              <span className="text-emerald-300 font-bold">{formatMonthDisplay(selectedMonth)}</span>
            </p>
          </div>
        </div>

        {/* Action Controls & Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Navigator */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-0.5 shadow-inner text-xs font-mono">
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

          {/* View Mode Switcher: Daily Bars vs Cumulative S-Curve vs Day-of-Week */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setChartView("bars")}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartView === "bars"
                  ? "bg-slate-800 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Daily performance bar chart"
            >
              <span className="material-symbols-outlined text-xs">bar_chart</span>
              <span className="hidden md:inline">Daily Bars</span>
            </button>
            <button
              type="button"
              onClick={() => setChartView("cumulative")}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartView === "cumulative"
                  ? "bg-slate-800 text-purple-300 border border-purple-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Cumulative month revenue trajectory (S-Curve)"
            >
              <span className="material-symbols-outlined text-xs">show_chart</span>
              <span className="hidden md:inline">Cumulative</span>
            </button>
            <button
              type="button"
              onClick={() => setChartView("weekday")}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartView === "weekday"
                  ? "bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Day of Week pattern analytics (Sun vs Mon vs Fri)"
            >
              <span className="material-symbols-outlined text-xs">calendar_view_week</span>
              <span className="hidden md:inline">Weekday Pattern</span>
            </button>
          </div>

          {/* Metric Selector (Revenue, Weight, Orders) */}
          {chartView !== "cumulative" && (
            <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setMetricMode("revenue")}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  metricMode === "revenue"
                    ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>₹ Rev</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricMode("weight")}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  metricMode === "weight"
                    ? "bg-cyan-500 text-slate-950 shadow-md font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>⚖️ Kg</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricMode("orders")}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  metricMode === "orders"
                    ? "bg-amber-400 text-slate-950 shadow-md font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🧾 Bills</span>
              </button>
            </div>
          )}

          {/* Trendline Toggle */}
          {chartView === "bars" && (
            <button
              type="button"
              onClick={() => setShowTrendLine((p) => !p)}
              className={`p-1.5 px-2.5 rounded-xl border text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                showTrendLine
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-slate-900 text-slate-400 border-slate-700"
              }`}
              title="Toggle 7-day rolling moving average trend line"
            >
              <span className="material-symbols-outlined text-xs">ssid_chart</span>
              <span className="hidden lg:inline">Trendline</span>
            </button>
          )}

          {/* Filter: All 31 Calendar Days vs Sales Days */}
          {chartView === "bars" && (
            <button
              type="button"
              onClick={() => setShowAllMonthDays((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-[11px] font-mono text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
              title="Toggle all calendar days vs sales-only days"
            >
              <span className="material-symbols-outlined text-xs">
                {showAllMonthDays ? "filter_list" : "calendar_month"}
              </span>
              <span className="hidden lg:inline">
                {showAllMonthDays ? "Active Only" : "All 31 Days"}
              </span>
            </button>
          )}

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

      {/* ─── Executive Summary KPI Telemetry Cards (5 High-Tech Cards) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4 relative z-10">
        {/* Card 1: Peak Sales Day Record */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-slate-900 border border-amber-500/40 shadow-lg shadow-amber-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono font-bold tracking-wider">
            <span className="text-amber-300 uppercase flex items-center gap-1">
              <span>🏆 Peak Record</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 text-[9px]">
              Top Day
            </span>
          </div>
          <div className="my-1.5">
            {peakDay ? (
              <>
                <div className="text-lg sm:text-xl font-black text-white font-mono leading-none">
                  ₹{peakDay.revenue.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-amber-300 font-mono font-bold mt-1">
                  {peakDay.fullLabel}
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-xs font-mono">No Sales Logged</div>
            )}
          </div>
          <div className="text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5 flex justify-between">
            <span>Vol: {peakDay ? `${formatKg(peakDay.weightKg)} Kg` : "—"}</span>
            <span className="text-amber-400">{peakDay ? `${peakDay.ordersCount} bills` : ""}</span>
          </div>
        </div>

        {/* Card 2: Total Month Revenue */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-900 border border-emerald-500/40 shadow-lg shadow-emerald-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono font-bold tracking-wider">
            <span className="text-emerald-300 uppercase flex items-center gap-1">
              <span>💰 Month Revenue</span>
            </span>
            <span className="text-emerald-400 text-[9px] font-mono font-bold">
              {monthTotals.activeDays} Days
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg sm:text-xl font-black text-white font-mono leading-none">
              ₹{monthTotals.revenue.toLocaleString("en-IN")}
            </div>
            {monthTotals.isCurrentActiveMonth && (
              <div className="text-[11px] text-emerald-300 font-mono mt-1 font-bold">
                Run-Rate: ~₹{monthTotals.projectedMonthRevenue.toLocaleString("en-IN")}
              </div>
            )}
          </div>
          <div className="text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5 flex justify-between">
            <span>Average: ₹{monthTotals.dailyAverageRevenue.toLocaleString("en-IN")}/day</span>
            <span className="text-emerald-400">100% Realized</span>
          </div>
        </div>

        {/* Card 3: Total Weight Harvested & Sold */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/90 to-slate-900 border border-cyan-500/40 shadow-lg shadow-cyan-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono font-bold tracking-wider">
            <span className="text-cyan-300 uppercase flex items-center gap-1">
              <span>⚖️ Biomass Sold</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 text-[9px]">
              Live Trout
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg sm:text-xl font-black text-white font-mono leading-none">
              {formatKg(monthTotals.weightKg)} <span className="text-xs text-cyan-300 font-normal">Kg</span>
            </div>
            <div className="text-[11px] text-cyan-300 font-mono mt-1">
              Avg {monthTotals.dailyAverageKg} Kg/day
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5 flex justify-between">
            <span>Online: ₹{monthTotals.online.toLocaleString("en-IN")}</span>
            <span className="text-cyan-400">Cash: ₹{monthTotals.cash.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Card 4: Weekend Surge Multiplier */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-slate-900 border border-purple-500/40 shadow-lg shadow-purple-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono font-bold tracking-wider">
            <span className="text-purple-300 uppercase flex items-center gap-1">
              <span>⚡ Weekend Surge</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30 text-[9px] font-bold">
              Fri-Sun
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg sm:text-xl font-black text-purple-300 font-mono leading-none">
              {monthTotals.weekendMultiplier >= 0 ? `+${monthTotals.weekendMultiplier}%` : `${monthTotals.weekendMultiplier}%`}
            </div>
            <div className="text-[11px] text-slate-300 font-mono mt-1 truncate">
              vs Mon–Thu sales pace
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5 flex justify-between">
            <span>Weekend Focus</span>
            <span className="text-purple-400 font-bold">Harvest Peak</span>
          </div>
        </div>

        {/* Card 5: Order Count & AOV */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-slate-900 border border-blue-500/40 shadow-lg shadow-blue-950/20 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono font-bold tracking-wider">
            <span className="text-blue-300 uppercase flex items-center gap-1">
              <span>🧾 Dispatches</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-200 border border-blue-500/30 text-[9px]">
              {monthTotals.orders} Total
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg sm:text-xl font-black text-white font-mono leading-none">
              ₹{monthTotals.orders > 0 ? Math.round(monthTotals.revenue / monthTotals.orders).toLocaleString("en-IN") : 0}
            </div>
            <div className="text-[11px] text-blue-300 font-mono mt-1">
              Avg Order Value (AOV)
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5 flex justify-between">
            <span>Avg Weight/Bill</span>
            <span className="text-blue-300 font-bold">
              {monthTotals.orders > 0 ? (monthTotals.weightKg / monthTotals.orders).toFixed(2) : 0} Kg
            </span>
          </div>
        </div>
      </div>

      {/* ─── Interactive Chart Canvas ─── */}
      <div className="bg-slate-950/90 border border-slate-800/80 rounded-2xl p-3 sm:p-4 relative overflow-hidden shadow-inner">
        {dailyData.length === 0 ? (
          <div className="py-20 text-center text-slate-500 font-mono text-sm">
            <span className="material-symbols-outlined text-4xl mb-2 text-slate-600 block">
              signal_cellular_nodata
            </span>
            No sales data recorded for {formatMonthDisplay(selectedMonth)}.
          </div>
        ) : (
          <div className="relative overflow-x-auto select-none">
            {/* VIEW 1: DAILY STACKED BARS + MOVING AVERAGE SPLINE */}
            {chartView === "bars" && (
              <svg
                className="w-full transition-all"
                style={{ minWidth: dailyData.length > 15 ? `${dailyData.length * 36}px` : "100%" }}
                height={chartHeight}
                viewBox={`0 0 ${Math.max(650, dailyData.length * 40 + paddingL + paddingR)} ${chartHeight}`}
              >
                <defs>
                  {/* Gutted Emerald Gradient */}
                  <linearGradient id="barGuttedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.85" />
                  </linearGradient>

                  {/* Non-Gutted Cyan Gradient */}
                  <linearGradient id="barNonGuttedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.85" />
                  </linearGradient>

                  {/* Peak Gold/Amber Gradient */}
                  <linearGradient id="barPeakGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                    <stop offset="60%" stopColor="#f59e0b" stopOpacity="1" />
                    <stop offset="100%" stopColor="#b45309" stopOpacity="0.9" />
                  </linearGradient>

                  {/* Orders Purple Gradient */}
                  <linearGradient id="barOrdersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="1" />
                    <stop offset="100%" stopColor="#7e22ce" stopOpacity="0.85" />
                  </linearGradient>

                  {/* Trendline Glow Filter */}
                  <filter id="neonTrendGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Y-Axis Horizontal Grid Lines */}
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
                        stroke="rgba(255, 255, 255, 0.07)"
                        strokeDasharray={idx === 0 ? undefined : "3 3"}
                      />
                      <text
                        x={paddingL - 10}
                        y={y + 3.5}
                        fill="#64748b"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Weekend Shading Bands & Bars Rendering */}
                {(() => {
                  const totalSvgWidth = Math.max(650, dailyData.length * 40 + paddingL + paddingR);
                  const chartWidth = totalSvgWidth - paddingL - paddingR;
                  const slotWidth = chartWidth / dailyData.length;
                  const barWidth = Math.min(30, Math.max(14, slotWidth - 8));

                  // Calculate coordinates for 7-day moving average curve
                  const trendPoints = dailyData.map((d, i) => {
                    const ma = movingAverages[i] || 0;
                    const cx = paddingL + i * slotWidth + slotWidth / 2;
                    const cy = paddingT + effectiveHeight - (maxValue > 0 ? (ma / maxValue) * effectiveHeight : 0);
                    return { x: cx, y: cy };
                  });

                  // Generate smooth bezier curve path string
                  let trendPathStr = "";
                  if (trendPoints.length > 0) {
                    trendPathStr = `M ${trendPoints[0].x} ${trendPoints[0].y}`;
                    for (let i = 0; i < trendPoints.length - 1; i++) {
                      const p0 = trendPoints[i];
                      const p1 = trendPoints[i + 1];
                      const midX = (p0.x + p1.x) / 2;
                      trendPathStr += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
                    }
                  }

                  return (
                    <>
                      {/* Weekend Shading Bands (Fri / Sat / Sun) */}
                      {dailyData.map((d, i) => {
                        if (!d.isWeekend) return null;
                        const bandX = paddingL + i * slotWidth;
                        return (
                          <rect
                            key={`wknd-${d.dateStr}`}
                            x={bandX}
                            y={paddingT}
                            width={slotWidth}
                            height={effectiveHeight}
                            fill="rgba(56, 189, 248, 0.025)"
                            className="pointer-events-none"
                          />
                        );
                      })}

                      {/* Moving Average Trendline (Overlaid underneath bars or above) */}
                      {showTrendLine && trendPoints.length > 1 && (
                        <path
                          d={trendPathStr}
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="2.5"
                          filter="url(#neonTrendGlow)"
                          opacity="0.85"
                          strokeDasharray="4 2"
                          className="pointer-events-none"
                        />
                      )}

                      {/* Daily Bars */}
                      {dailyData.map((d, i) => {
                        const val = metricMode === "revenue" ? d.revenue : metricMode === "weight" ? d.weightKg : d.ordersCount;
                        const barHeight = maxValue > 0 ? (val / maxValue) * effectiveHeight : 0;
                        const x = paddingL + i * slotWidth + (slotWidth - barWidth) / 2;
                        const y = paddingT + effectiveHeight - barHeight;
                        const isPeak = peakDay && d.dateStr === peakDay.dateStr && val > 0;
                        const isSelected = activeDay && d.dateStr === activeDay.dateStr;
                        const isHovered = hoveredDay && d.dateStr === hoveredDay.dateStr;

                        // Composition split: Gutted vs Non-Gutted
                        const totalKgDay = d.guttedKg + d.nonGuttedKg;
                        const guttedRatio = totalKgDay > 0 ? d.guttedKg / totalKgDay : 1;
                        const guttedBarHeight = barHeight * guttedRatio;
                        const nonGuttedBarHeight = barHeight - guttedBarHeight;

                        let mainFill = "url(#barGuttedGrad)";
                        if (isPeak) mainFill = "url(#barPeakGrad)";
                        else if (metricMode === "orders") mainFill = "url(#barOrdersGrad)";

                        return (
                          <g
                            key={d.dateStr}
                            className="cursor-pointer transition-all duration-200 group"
                            onMouseEnter={(e) => handleBarHover(e, d)}
                            onMouseMove={(e) => handleBarHover(e, d)}
                            onMouseLeave={() => setHoveredDay(null)}
                            onClick={() => setSelectedDate(d.dateStr)}
                          >
                            {/* Zero day subtle indicator */}
                            {val === 0 && (
                              <rect
                                x={x}
                                y={paddingT + effectiveHeight - 4}
                                width={barWidth}
                                height={4}
                                rx={2}
                                fill="rgba(255, 255, 255, 0.12)"
                              />
                            )}

                            {/* Active Bar */}
                            {val > 0 && (
                              <g>
                                {/* Active / Hover Glow Ring */}
                                {(isSelected || isHovered) && (
                                  <rect
                                    x={x - 2.5}
                                    y={y - 2.5}
                                    width={barWidth + 5}
                                    height={barHeight + 5}
                                    rx={7}
                                    fill="none"
                                    stroke={isPeak ? "#f59e0b" : "#34d399"}
                                    strokeWidth="2"
                                    opacity={isSelected ? "1" : "0.75"}
                                  />
                                )}

                                {/* Stacked: Gutted Portion (Bottom) */}
                                <rect
                                  x={x}
                                  y={y + nonGuttedBarHeight}
                                  width={barWidth}
                                  height={Math.max(2, guttedBarHeight)}
                                  rx={nonGuttedBarHeight > 0 ? 0 : 5}
                                  fill={mainFill}
                                  opacity={isHovered ? 1 : isSelected ? 0.95 : 0.85}
                                />

                                {/* Stacked: Non-Gutted Portion (Top) */}
                                {nonGuttedBarHeight > 0 && !isPeak && metricMode !== "orders" && (
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={nonGuttedBarHeight}
                                    rx={4}
                                    fill="url(#barNonGuttedGrad)"
                                    opacity={isHovered ? 1 : 0.85}
                                  />
                                )}

                                {/* Peak Day Crown Icon */}
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

                            {/* X-Axis Date Number */}
                            <text
                              x={x + barWidth / 2}
                              y={paddingT + effectiveHeight + 15}
                              fill={isSelected ? "#34d399" : isPeak ? "#fbbf24" : d.isWeekend ? "#38bdf8" : "#94a3b8"}
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
                              fill={d.isWeekend ? "#38bdf8" : "#64748b"}
                              fontSize="9"
                              fontFamily="monospace"
                              textAnchor="middle"
                              fontWeight={d.isWeekend ? "bold" : "normal"}
                            >
                              {d.dayOfWeek}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            )}

            {/* VIEW 2: CUMULATIVE S-CURVE (MONTH TRAJECTORY) */}
            {chartView === "cumulative" && (
              <svg
                className="w-full"
                height={chartHeight}
                viewBox={`0 0 ${Math.max(650, cumulativeData.length * 40 + paddingL + paddingR)} ${chartHeight}`}
              >
                <defs>
                  <linearGradient id="cumAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Lines for Cumulative */}
                {gridSteps.map((ratio, idx) => {
                  const y = paddingT + (1 - ratio) * effectiveHeight;
                  const val = ratio * monthTotals.revenue;
                  return (
                    <g key={idx}>
                      <line x1={paddingL} y1={y} x2="98%" y2={y} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
                      <text x={paddingL - 10} y={y + 3.5} fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="end">
                        ₹{val >= 100000 ? `${(val / 100000).toFixed(1)}L` : `${Math.round(val / 1000)}k`}
                      </text>
                    </g>
                  );
                })}

                {(() => {
                  const totalSvgWidth = Math.max(650, cumulativeData.length * 40 + paddingL + paddingR);
                  const chartWidth = totalSvgWidth - paddingL - paddingR;
                  const slotWidth = chartWidth / cumulativeData.length;

                  const points = cumulativeData.map((d, i) => {
                    const cx = paddingL + i * slotWidth + slotWidth / 2;
                    const cy = paddingT + effectiveHeight - (monthTotals.revenue > 0 ? (d.cumulativeRevenue / monthTotals.revenue) * effectiveHeight : 0);
                    return { x: cx, y: cy, ...d };
                  });

                  if (points.length === 0) return null;

                  let pathD = `M ${points[0].x} ${points[0].y}`;
                  for (let i = 0; i < points.length - 1; i++) {
                    const midX = (points[i].x + points[i + 1].x) / 2;
                    pathD += ` C ${midX} ${points[i].y}, ${midX} ${points[i + 1].y}, ${points[i + 1].x} ${points[i + 1].y}`;
                  }

                  const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingT + effectiveHeight} L ${points[0].x} ${paddingT + effectiveHeight} Z`;

                  return (
                    <>
                      <path d={areaD} fill="url(#cumAreaGrad)" />
                      <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth="3" />

                      {points.map((p) => (
                        <circle
                          key={p.dateStr}
                          cx={p.x}
                          cy={p.y}
                          r="4"
                          fill="#8b5cf6"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="cursor-pointer hover:r-6 transition-all"
                          onMouseEnter={(e) => handleBarHover(e, p)}
                          onMouseMove={(e) => handleBarHover(e, p)}
                          onMouseLeave={() => setHoveredDay(null)}
                          onClick={() => setSelectedDate(p.dateStr)}
                        />
                      ))}
                    </>
                  );
                })()}
              </svg>
            )}

            {/* VIEW 3: DAY OF WEEK INTELLIGENCE (SUN..SAT) */}
            {chartView === "weekday" && (
              <svg className="w-full" height={chartHeight} viewBox={`0 0 700 ${chartHeight}`}>
                <defs>
                  <linearGradient id="wkndBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
                    <stop offset="100%" stopColor="#b45309" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="wkdayBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
                    <stop offset="100%" stopColor="#0e7490" stopOpacity="0.85" />
                  </linearGradient>
                </defs>

                {gridSteps.map((ratio, idx) => {
                  const y = paddingT + (1 - ratio) * effectiveHeight;
                  const val = ratio * maxValue;
                  const label = metricMode === "revenue" ? `₹${Math.round(val / 1000)}k` : `${Math.round(val)}`;
                  return (
                    <g key={idx}>
                      <line x1={paddingL} y1={y} x2="680" y2={y} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
                      <text x={paddingL - 10} y={y + 3.5} fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="end">
                        {label}
                      </text>
                    </g>
                  );
                })}

                {weekdayAverages.map((w, i) => {
                  const val = metricMode === "revenue" ? w.avgRevenue : metricMode === "weight" ? w.avgWeightKg : w.totalOrders;
                  const barHeight = maxValue > 0 ? (val / maxValue) * effectiveHeight : 0;
                  const slotWidth = (700 - paddingL - paddingR) / 7;
                  const barWidth = 45;
                  const x = paddingL + i * slotWidth + (slotWidth - barWidth) / 2;
                  const y = paddingT + effectiveHeight - barHeight;
                  const isWknd = ["Sun", "Fri", "Sat"].includes(w.dayName);

                  return (
                    <g key={w.dayName} className="group cursor-pointer">
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(4, barHeight)}
                        rx={6}
                        fill={isWknd ? "url(#wkndBarGrad)" : "url(#wkdayBarGrad)"}
                        className="transition-all hover:opacity-100 opacity-90"
                      />
                      <text
                        x={x + barWidth / 2}
                        y={y - 8}
                        fill="#ffffff"
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {metricMode === "revenue" ? `₹${Math.round(w.avgRevenue / 1000)}k` : `${w.avgWeightKg}k`}
                      </text>
                      <text
                        x={x + barWidth / 2}
                        y={paddingT + effectiveHeight + 16}
                        fill={isWknd ? "#f59e0b" : "#e2e8f0"}
                        fontSize="11"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {w.dayName}
                      </text>
                      <text
                        x={x + barWidth / 2}
                        y={paddingT + effectiveHeight + 30}
                        fill="#64748b"
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {w.daysCount} occurrences
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        )}

        {/* ─── Legend & Chart Info Footer ─── */}
        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 mt-2.5 px-2 pt-2 border-t border-slate-800/80 gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
              <span className="text-amber-300 font-bold">Peak Day (11 Oct)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-500"></span>
              <span className="text-emerald-300">Gutted Fish</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-sky-400"></span>
              <span className="text-sky-300">Non-Gutted Fish</span>
            </span>
            {showTrendLine && chartView === "bars" && (
              <span className="flex items-center gap-1.5 text-purple-300">
                <span className="w-4 h-0.5 border-b-2 border-dashed border-purple-400"></span>
                <span>7-Day Moving Avg</span>
              </span>
            )}
          </div>
          <div className="text-slate-400 text-[11px] flex items-center gap-1">
            <span>💡</span>
            <span className="text-slate-300">Tap any bar</span> to inspect full day metrics &amp; ledger dispatches below
          </div>
        </div>
      </div>

      {/* ─── Floating High-Tech Glassmorphic Tooltip ─── */}
      {hoveredDay && tooltipPos && (
        <div
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 p-3 rounded-2xl bg-slate-900/95 border border-emerald-400/50 shadow-2xl shadow-slate-950/80 backdrop-blur-md text-xs font-mono min-w-[210px] animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${Math.min(Math.max(120, tooltipPos.x), 850)}px`,
            top: `${Math.max(60, tooltipPos.y - 10)}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-extrabold text-white text-[12px] flex items-center gap-1">
              <span>🗓️ {hoveredDay.fullLabel}</span>
            </span>
            {peakDay && hoveredDay.dateStr === peakDay.dateStr ? (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/40">
                👑 Peak Day
              </span>
            ) : hoveredDay.isWeekend ? (
              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px] font-bold">
                Weekend
              </span>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400">💰 Day Revenue:</span>
              <span className="font-extrabold text-white text-[13px]">
                ₹{hoveredDay.revenue.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">⚖️ Weight Sold:</span>
              <span className="font-bold text-cyan-300">{formatKg(hoveredDay.weightKg)} Kg</span>
            </div>
            <div className="flex justify-between text-[10.5px]">
              <span className="text-emerald-400">· Gutted: {formatKg(hoveredDay.guttedKg)} Kg</span>
              <span className="text-sky-300">· Non: {formatKg(hoveredDay.nonGuttedKg)} Kg</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">🧾 Dispatches:</span>
              <span className="font-bold text-amber-300">{hoveredDay.ordersCount} Bills</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>💳 UPI: ₹{hoveredDay.onlineRevenue.toLocaleString("en-IN")}</span>
              <span>💵 Cash: ₹{hoveredDay.cashRevenue.toLocaleString("en-IN")}</span>
            </div>
            {monthTotals.dailyAverageRevenue > 0 && hoveredDay.revenue > 0 && (
              <div className="pt-1 border-t border-slate-800/80 text-[10px] flex justify-between font-bold">
                <span className="text-slate-400">vs Daily Avg:</span>
                <span
                  className={
                    hoveredDay.revenue >= monthTotals.dailyAverageRevenue
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }
                >
                  {hoveredDay.revenue >= monthTotals.dailyAverageRevenue ? "+" : ""}
                  {(
                    ((hoveredDay.revenue - monthTotals.dailyAverageRevenue) /
                      monthTotals.dailyAverageRevenue) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Detailed Day Flashcards (Interactive Details on Click) ─── */}
      {activeDay && (
        <div className="mt-4 bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">event_available</span>
              <span className="text-white font-bold text-sm font-mono">
                Detailed Telemetry: {activeDay.fullLabel}
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
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95"
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
                {activeDay.surplusKg > 0 && (
                  <div className="flex justify-between text-amber-300 font-bold pt-0.5 border-t border-slate-800/60">
                    <span>🎁 Procurement Surplus:</span>
                    <span>+{formatKg(activeDay.surplusKg)} Kg (100% Profit)</span>
                  </div>
                )}
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
                Effective Sell Rate:{" "}
                <span className="text-white font-bold">
                  ₹{activeDay.weightKg > 0 ? Math.round(activeDay.revenue / activeDay.weightKg) : 0}/Kg
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
