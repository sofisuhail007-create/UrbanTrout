"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

export interface TimePickerInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  required?: boolean;
  accentColor?: "emerald" | "cyan" | "blue" | "rose";
  className?: string;
}

// Helper: parse any 12h or 24h string into { hours12: 1-12, minutes: 0-59, meridiem: 'am' | 'pm' }
export function parseTimeString(timeStr?: string | null): {
  hours12: number;
  minutes: number;
  meridiem: "am" | "pm";
  hours24: number;
} {
  if (!timeStr || !timeStr.trim()) {
    const now = new Date();
    const h24 = now.getHours();
    const m = now.getMinutes();
    const meridiem = h24 >= 12 ? "pm" : "am";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { hours12: h12, minutes: m, meridiem, hours24: h24 };
  }

  const str = timeStr.trim().toLowerCase();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return { hours12: 12, minutes: 0, meridiem: "pm", hours24: 12 };
  }

  let h = parseInt(match[1], 10);
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  const mer = match[4]?.toLowerCase();

  let meridiem: "am" | "pm" = "am";
  let hours24 = h;

  if (mer === "pm") {
    meridiem = "pm";
    hours24 = h < 12 ? h + 12 : h;
  } else if (mer === "am") {
    meridiem = "am";
    hours24 = h === 12 ? 0 : h;
  } else {
    // 24-hour format
    meridiem = h >= 12 ? "pm" : "am";
    hours24 = h;
    h = h % 12;
    if (h === 0) h = 12;
  }

  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;

  return { hours12, minutes: m, meridiem, hours24 };
}

export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr || !timeStr.trim()) return 0;
  const { hours24, minutes } = parseTimeString(timeStr);
  return hours24 * 60 + minutes;
}

// Convert hours12, minutes, and meridiem to "hh:mm am/pm"
export function formatTime12(hours12: number, minutes: number, meridiem: "am" | "pm"): string {
  const hh = String(hours12).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm} ${meridiem}`;
}

// Convert to 24-hour "HH:mm" for native <input type="time">
export function formatTime24(hours12: number, minutes: number, meridiem: "am" | "pm"): string {
  let h24 = hours12 % 12;
  if (meridiem === "pm") h24 += 12;
  const hh = String(h24).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Get current IST time formatted as "hh:mm am/pm"
export function getIstCurrentTime(): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
      .format(new Date())
      .toLowerCase();
  } catch (_) {
    return new Date()
      .toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
  }
}

// Get time offset relative to right now in IST (e.g., -5 mins, -15 mins)
export function getRelativeIstTime(offsetMinutes: number): string {
  try {
    const now = new Date();
    const shifted = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
      .format(shifted)
      .toLowerCase();
  } catch (_) {
    const now = new Date();
    const shifted = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    return shifted
      .toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
  }
}

export default function TimePickerInput({
  value,
  onChange,
  label = "Time",
  required = false,
  accentColor = "emerald",
  className = "",
}: TimePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Parsed components
  const { hours12, minutes, meridiem, hours24 } = useMemo(
    () => parseTimeString(value),
    [value]
  );

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Color schemes
  const colorMap = {
    emerald: {
      activeBg: "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30",
      pillBorder: "border-emerald-500/40 text-emerald-300",
      accentText: "text-emerald-400",
      glowBorder: "border-emerald-400/90 ring-1 ring-emerald-500/40",
      hoverCard: "hover:border-emerald-500/50",
      badgeBg: "bg-emerald-950/80 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/60",
    },
    cyan: {
      activeBg: "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30",
      pillBorder: "border-cyan-500/40 text-cyan-300",
      accentText: "text-cyan-400",
      glowBorder: "border-cyan-400/90 ring-1 ring-cyan-500/40",
      hoverCard: "hover:border-cyan-500/50",
      badgeBg: "bg-cyan-950/80 text-cyan-400 border-cyan-500/30 hover:bg-cyan-900/60",
    },
    blue: {
      activeBg: "bg-blue-500 text-white font-bold shadow-md shadow-blue-500/30",
      pillBorder: "border-blue-500/40 text-blue-300",
      accentText: "text-blue-400",
      glowBorder: "border-blue-400/90 ring-1 ring-blue-500/40",
      hoverCard: "hover:border-blue-500/50",
      badgeBg: "bg-blue-950/80 text-blue-400 border-blue-500/30 hover:bg-blue-900/60",
    },
    rose: {
      activeBg: "bg-rose-500 text-white font-bold shadow-md shadow-rose-500/30",
      pillBorder: "border-rose-500/40 text-rose-300",
      accentText: "text-rose-400",
      glowBorder: "border-rose-400/90 ring-1 ring-rose-500/40",
      hoverCard: "hover:border-rose-500/50",
      badgeBg: "bg-rose-950/80 text-rose-400 border-rose-500/30 hover:bg-rose-900/60",
    },
  };

  const scheme = colorMap[accentColor] || colorMap.emerald;

  // Handlers
  const handleSelectHour = (h: number) => {
    onChange(formatTime12(h, minutes, meridiem));
  };

  const handleSelectMinute = (m: number) => {
    onChange(formatTime12(hours12, m, meridiem));
  };

  const handleToggleMeridiem = (mer: "am" | "pm") => {
    onChange(formatTime12(hours12, minutes, mer));
  };

  const handleStepMinute = (delta: number) => {
    let newM = minutes + delta;
    let newH = hours12;
    let newMer = meridiem;

    if (newM >= 60) {
      newM = newM % 60;
      newH += 1;
      if (newH === 12) {
        newMer = newMer === "am" ? "pm" : "am";
      } else if (newH > 12) {
        newH = 1;
      }
    } else if (newM < 0) {
      newM = 60 + newM;
      newH -= 1;
      if (newH === 0) {
        newH = 12;
      } else if (newH === 11) {
        newMer = newMer === "am" ? "pm" : "am";
      }
    }

    onChange(formatTime12(newH, newM, newMer));
  };

  const handleStepHour = (delta: number) => {
    let newH = hours12 + delta;
    let newMer = meridiem;
    if (newH > 12) newH = 1;
    if (newH < 1) newH = 12;
    if ((delta > 0 && newH === 12) || (delta < 0 && newH === 11)) {
      newMer = newMer === "am" ? "pm" : "am";
    }
    onChange(formatTime12(newH, minutes, newMer));
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // "HH:mm"
    if (!val) return;
    const [hStr, mStr] = val.split(":");
    const h24 = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const mer = h24 >= 12 ? "pm" : "am";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    onChange(formatTime12(h12, m, mer));
  };

  const openNativePicker = () => {
    if (nativeInputRef.current) {
      try {
        if ("showPicker" in HTMLInputElement.prototype) {
          nativeInputRef.current.showPicker();
        } else {
          nativeInputRef.current.focus();
        }
      } catch (_) {
        nativeInputRef.current.focus();
      }
    }
  };

  const hoursList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minuteIntervals = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Premium POS Time Card Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-950/80 border ${
          isOpen ? scheme.glowBorder : `border-slate-800 ${scheme.hoverCard}`
        } rounded-2xl p-2.5 sm:p-3 transition-all cursor-pointer select-none group shadow-inner flex flex-col justify-between`}
      >
        {/* Card Header Row */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className={`material-symbols-outlined text-[13px] ${scheme.accentText}`}>schedule</span>
            {label} {required && <span className={scheme.accentText}>*</span>}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(getIstCurrentTime());
            }}
            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${scheme.badgeBg}`}
            title="Set to current IST time"
          >
            <span className="material-symbols-outlined text-[10px]">bolt</span>
            Now
          </button>
        </div>

        {/* Card Value Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-sm sm:text-base font-extrabold text-white tracking-wider">
              {String(hours12).padStart(2, "0")} : {String(minutes).padStart(2, "0")}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${scheme.pillBorder} bg-slate-900/90 shadow-sm`}
            >
              {meridiem}
            </span>
          </div>

          <span
            className={`material-symbols-outlined text-base text-slate-500 transition-transform group-hover:text-emerald-400 ${
              isOpen ? "rotate-180 text-emerald-400" : ""
            }`}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Hidden Native Time Input to support system wheel dialog */}
      <input
        ref={nativeInputRef}
        type="time"
        value={formatTime24(hours12, minutes, meridiem)}
        onChange={handleNativeChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Interactive Time Selector Popover Modal */}
      {isOpen && (
        <div
          className="absolute z-50 mt-2 left-0 sm:left-auto right-0 sm:w-80 bg-slate-950/98 backdrop-blur-2xl border border-slate-700/90 rounded-3xl p-4 shadow-2xl shadow-black/90 space-y-3.5 font-mono animate-in fade-in zoom-in-95 duration-150"
          style={{ minWidth: "285px" }}
        >
          {/* Readout with Steppers and AM/PM */}
          <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl">
            {/* Hour Stepper */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepHour(-1)}
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs cursor-pointer transition-colors"
              >
                ▼
              </button>
              <div className="text-center px-1.5">
                <span className="block text-base font-extrabold text-white leading-none">
                  {String(hours12).padStart(2, "0")}
                </span>
                <span className="text-[8px] text-slate-500 uppercase tracking-tighter">Hour</span>
              </div>
              <button
                type="button"
                onClick={() => handleStepHour(1)}
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs cursor-pointer transition-colors"
              >
                ▲
              </button>
            </div>

            <span className="text-base font-bold text-slate-600">:</span>

            {/* Minute Stepper */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleStepMinute(-1)}
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs cursor-pointer transition-colors"
              >
                ▼
              </button>
              <div className="text-center px-1.5">
                <span className="block text-base font-extrabold text-white leading-none">
                  {String(minutes).padStart(2, "0")}
                </span>
                <span className="text-[8px] text-slate-500 uppercase tracking-tighter">Min</span>
              </div>
              <button
                type="button"
                onClick={() => handleStepMinute(1)}
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs cursor-pointer transition-colors"
              >
                ▲
              </button>
            </div>

            {/* AM / PM Segmented Switch */}
            <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleToggleMeridiem("am")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  meridiem === "am"
                    ? scheme.activeBg
                    : "text-slate-400 hover:text-white"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handleToggleMeridiem("pm")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  meridiem === "pm"
                    ? scheme.activeBg
                    : "text-slate-400 hover:text-white"
                }`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Quick Hours Grid (1 - 12) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Select Hour</span>
              <span className="text-[8px] text-slate-500 font-normal">1-tap</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {hoursList.map((h) => {
                const isSel = hours12 === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSelectHour(h)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      isSel
                        ? scheme.activeBg
                        : "bg-slate-900/90 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Minute Grid (:00 to :55) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Select Minute</span>
              <div className="flex items-center gap-1 text-[8px]">
                <button
                  type="button"
                  onClick={() => handleStepMinute(-5)}
                  className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                >
                  -5m
                </button>
                <button
                  type="button"
                  onClick={() => handleStepMinute(5)}
                  className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                >
                  +5m
                </button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {minuteIntervals.map((m) => {
                const isSel = minutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMinute(m)}
                    className={`py-1.5 rounded-xl text-[11px] font-mono transition-all cursor-pointer text-center ${
                      isSel
                        ? scheme.activeBg
                        : "bg-slate-900/90 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    :{String(m).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Presets Row (Spacious & Clean inside popover) */}
          <div className="space-y-1 pt-1 border-t border-slate-800/80">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Quick Shortcuts
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => onChange(getIstCurrentTime())}
                className="py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 transition-colors text-center cursor-pointer"
              >
                ⚡ Now
              </button>
              <button
                type="button"
                onClick={() => onChange(getRelativeIstTime(-15))}
                className="py-1 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-center cursor-pointer"
              >
                -15m
              </button>
              <button
                type="button"
                onClick={() => onChange(getRelativeIstTime(-30))}
                className="py-1 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-center cursor-pointer"
              >
                -30m
              </button>
              <button
                type="button"
                onClick={() => onChange(getRelativeIstTime(-60))}
                className="py-1 rounded-lg text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-center cursor-pointer"
              >
                -1h
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={openNativePicker}
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer py-1.5 px-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xs">tune</span>
              Clock Wheel
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="py-1.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              Done ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
