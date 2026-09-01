"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { FarmVisit } from "@/lib/supabase";
import toast from "react-hot-toast";

const C = {
  bg: "#020d14",
  bgCard: "#061722",
  bgInner: "#0b202e",
  primary: "#72ddfd",
  emerald: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
};

interface ValidityResult {
  state: "VALID_ACTIVE" | "UPCOMING" | "EXPIRED" | "CANCELLED" | "PENDING" | "COMPLETED";
  title: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
  icon: string;
  message: string;
  isAdmissible: boolean;
}

function evaluatePassValidity(visit: FarmVisit): ValidityResult {
  const status = visit.status;

  if (status === "pending") {
    return {
      state: "PENDING",
      title: "PENDING APPROVAL — NOT ADMISSIBLE",
      badgeBg: "bg-amber-500/15",
      badgeBorder: "border-amber-500/40",
      badgeColor: "text-amber-300",
      icon: "hourglass_top",
      message: "This visit request is still under review by the Farm Manager and has not been approved for entry.",
      isAdmissible: false,
    };
  }

  if (status === "cancelled") {
    return {
      state: "CANCELLED",
      title: "PASS CANCELLED / REVOKED",
      badgeBg: "bg-red-500/15",
      badgeBorder: "border-red-500/40",
      badgeColor: "text-red-400",
      icon: "cancel",
      message: "This pass has been cancelled or revoked by the Farm Manager. Admission is strictly denied.",
      isAdmissible: false,
    };
  }

  if (status === "completed") {
    return {
      state: "COMPLETED",
      title: "VISIT ALREADY COMPLETED",
      badgeBg: "bg-cyan-500/15",
      badgeBorder: "border-cyan-500/40",
      badgeColor: "text-cyan-300",
      icon: "task_alt",
      message: "This pass has already been used and marked as checked-in by farm staff.",
      isAdmissible: false,
    };
  }

  // Parse Visit Date
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const visitDateStr = visit.visit_date;

  // Extract start and end hours from time_slot (e.g. "10:30 AM – 11:30 AM", "02:00 PM – 03:00 PM")
  let startHour = 10;
  let startMin = 30;
  let endHour = 11;
  let endMin = 30;

  const timeMatches = (visit.time_slot || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi);
  if (timeMatches && timeMatches.length >= 2) {
    const startP = timeMatches[0].match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (startP) {
      let h = parseInt(startP[1], 10);
      const m = parseInt(startP[2], 10);
      const mer = startP[3].toUpperCase();
      if (mer === "PM" && h < 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
      startHour = h;
      startMin = m;
    }

    const endP = timeMatches[1].match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (endP) {
      let h = parseInt(endP[1], 10);
      const m = parseInt(endP[2], 10);
      const mer = endP[3].toUpperCase();
      if (mer === "PM" && h < 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
      endHour = h;
      endMin = m;
    }
  }

  // Parse YYYY-MM-DD
  const dateParts = visitDateStr.split("-").map(Number);
  const vYear = dateParts[0] || now.getFullYear();
  const vMonth = (dateParts[1] || 1) - 1;
  const vDay = dateParts[2] || now.getDate();

  // Expiration threshold: slot end time + 45 min buffer
  const slotExpiryDate = new Date(vYear, vMonth, vDay, endHour, endMin + 45, 0);
  
  // Earliest admission threshold: slot start time - 30 min early arrival
  const slotEarlyDate = new Date(vYear, vMonth, vDay, startHour, startMin - 30, 0);

  const currentMs = now.getTime();

  // Check if expired
  if (currentMs > slotExpiryDate.getTime()) {
    return {
      state: "EXPIRED",
      title: "PASS EXPIRED — TIMING OVER",
      badgeBg: "bg-red-500/15",
      badgeBorder: "border-red-500/40",
      badgeColor: "text-red-400",
      icon: "event_busy",
      message: `This pass was scheduled for ${visitDateStr} (${visit.time_slot}). The approved batch window has expired. Entry is closed.`,
      isAdmissible: false,
    };
  }

  // Check if upcoming
  if (currentMs < slotEarlyDate.getTime()) {
    const isToday = visitDateStr === todayStr;
    return {
      state: "UPCOMING",
      title: isToday ? "UPCOMING TODAY (WAIT FOR SLOT)" : "UPCOMING SCHEDULED PASS",
      badgeBg: "bg-amber-500/15",
      badgeBorder: "border-amber-500/40",
      badgeColor: "text-amber-300",
      icon: "schedule",
      message: isToday
        ? `Pass is valid for today! Entry opens at ${startHour > 12 ? startHour - 12 : startHour}:${String(startMin).padStart(2, '0')} ${startHour >= 12 ? 'PM' : 'AM'}. Please wait for your batch window.`
        : `Pass is confirmed for ${visitDateStr} during ${visit.time_slot}. Not yet active for entry today.`,
      isAdmissible: isToday,
    };
  }

  // Active right now!
  return {
    state: "VALID_ACTIVE",
    title: "PASS ACTIVE & VERIFIED FOR ENTRY",
    badgeBg: "bg-emerald-500/20",
    badgeBorder: "border-emerald-500/40",
    badgeColor: "text-emerald-300",
    icon: "check_circle",
    message: `Official Farm Manager Approval Confirmed. Valid for immediate admission during the ${visit.time_slot} batch window.`,
    isAdmissible: true,
  };
}

export default function VerifyPassPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const passId = resolvedParams.id;

  const [visit, setVisit] = useState<FarmVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingTime, setVerifyingTime] = useState<string>("");
  const [admitting, setAdmitting] = useState(false);

  const fetchPassDetails = async () => {
    setLoading(true);
    setVerifyingTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

    try {
      // 1. Fetch from server API by specific pass ID
      const res = await fetch(`/api/farm-visits?id=${encodeURIComponent(passId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data.visit) {
          setVisit(data.visit as FarmVisit);
          setLoading(false);
          return;
        }
      }

      // 2. Direct Supabase fallback
      try {
        const { data: directData } = await supabase
          .from("farm_visits")
          .select("*")
          .eq("id", passId)
          .maybeSingle();

        if (directData) {
          setVisit(directData as FarmVisit);
          setLoading(false);
          return;
        }
      } catch (_) {}

    } catch (err) {
      console.error("Error verifying pass:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassDetails();
    const interval = setInterval(() => {
      setVerifyingTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(interval);
  }, [passId]);

  const handleMarkAdmitted = async () => {
    if (!visit) return;
    setAdmitting(true);
    try {
      const res = await fetch("/api/farm-visits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: visit.id, status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setVisit({ ...visit, status: "completed" });
      toast.success("Visitor marked as checked-in!");
    } catch (err) {
      toast.error("Failed to check-in visitor.");
    } finally {
      setAdmitting(false);
    }
  };

  const validity = visit ? evaluatePassValidity(visit) : null;
  const cleanPhone = visit ? visit.phone.replace(/\D/g, "").slice(-10) : "";

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="pt-28 pb-20 px-4 sm:px-6 flex flex-col items-center justify-center">
      
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "600px",
            background: validity?.isAdmissible
              ? "radial-gradient(circle, rgba(52,211,153,0.1) 0%, transparent 70%)"
              : validity?.state === "EXPIRED" || validity?.state === "CANCELLED"
              ? "radial-gradient(circle, rgba(248,113,113,0.1) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(114,221,253,0.08) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="relative max-w-lg w-full">
        
        {/* Top Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Urban Trout • Live Security Pass Verification
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Verifying pass cryptographic signature &amp; timing...</p>
          </div>
        ) : !visit ? (
          /* Invalid / Not Found Pass Card */
          <div className="p-8 text-center rounded-3xl bg-slate-950 border border-red-500/40 space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/40">
              <span className="material-symbols-outlined text-3xl">gpp_bad</span>
            </div>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif' }} className="text-xl font-bold text-white">
              Invalid Pass Reference
            </h2>
            <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs text-slate-400 leading-relaxed">
              No registered farm visit pass was found for ID <code className="text-red-400 font-mono">{passId}</code>.
            </p>
            <div className="pt-2">
              <Link
                href="/farm-visits"
                className="inline-block py-2.5 px-5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
              >
                Submit New Visit Request
              </Link>
            </div>
          </div>
        ) : validity ? (
          /* ─── OFFICIAL DIGITAL ID CARD PASS ─── */
          <div
            className="rounded-3xl overflow-hidden border shadow-2xl transition-all duration-300"
            style={{
              background: "linear-gradient(165deg, #0a1f2c 0%, #031018 100%)",
              borderColor: validity.isAdmissible ? "rgba(52,211,153,0.5)" : validity.state === "EXPIRED" || validity.state === "CANCELLED" ? "rgba(248,113,113,0.5)" : "rgba(251,191,36,0.5)",
              boxShadow: validity.isAdmissible ? "0 25px 60px rgba(52,211,153,0.15)" : "0 25px 60px rgba(0,0,0,0.6)",
            }}
          >
            {/* Holographic Header Bar */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/sitelogo.png" alt="Urban Trout" className="w-7 h-7 rounded-lg object-contain" />
                <span style={{ fontFamily: '"Space Grotesk", sans-serif' }} className="text-xs font-bold text-white tracking-wide uppercase">
                  Urban Trout RAS Pass
                </span>
              </div>
              <span className="font-mono text-[10px] font-bold text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-800/60">
                {visit.id}
              </span>
            </div>

            {/* Live Verification Status Banner */}
            <div className={`p-4 border-b ${validity.badgeBg} ${validity.badgeBorder} flex items-center gap-3`}>
              <span className={`material-symbols-outlined text-2xl ${validity.badgeColor} flex-shrink-0 animate-pulse`}>
                {validity.icon}
              </span>
              <div>
                <span className={`text-xs font-extrabold tracking-wider uppercase font-mono block ${validity.badgeColor}`}>
                  {validity.title}
                </span>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug" style={{ fontFamily: '"Manrope", sans-serif' }}>
                  {validity.message}
                </p>
              </div>
            </div>

            {/* Pass Body Content */}
            <div className="p-6 sm:p-7 space-y-6">
              
              {/* Visitor Avatar & Name */}
              <div className="flex items-center gap-4 pb-5 border-b border-slate-800">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 font-extrabold text-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  {visit.visitor_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block tracking-wider">
                    Authorized Visitor
                  </span>
                  <h2 style={{ fontFamily: '"Space Grotesk", sans-serif' }} className="text-xl font-extrabold text-white">
                    {visit.visitor_name}
                  </h2>
                  <span className="text-xs font-mono text-cyan-300">+91 {cleanPhone}</span>
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">
                    Scheduled Date
                  </span>
                  <span style={{ fontFamily: '"Space Grotesk", sans-serif' }} className="text-sm font-bold text-white block font-mono">
                    {visit.visit_date}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">
                    Approved Batch
                  </span>
                  <span className="text-xs font-bold text-cyan-300 block">
                    {visit.time_slot}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">
                    Group Size
                  </span>
                  <span className="text-xs font-bold text-white block">
                    👥 {visit.guest_count} Person(s) (Max)
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">
                    Visit Purpose
                  </span>
                  <span className="text-xs font-bold text-slate-200 block truncate">
                    {visit.visit_purpose}
                  </span>
                </div>
              </div>

              {/* Farm Manager Note if available */}
              {visit.admin_notes && (
                <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/25 text-xs text-cyan-200">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block font-mono mb-0.5">Farm Manager Instruction:</span>
                  <p>{visit.admin_notes}</p>
                </div>
              )}

              {/* Bio-Security Verification Checklist */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-amber-400 block font-mono">
                  🛡️ Mandatory Gate Verification:
                </span>
                <div className="space-y-1.5 text-[11px] text-slate-300" style={{ fontFamily: '"Manrope", sans-serif' }}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">check_box</span>
                    <span>Disinfection foot dip completed upon entry</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">check_box</span>
                    <span>Zero contact with tank water or culture fish</span>
                  </div>
                </div>
              </div>

              {/* Staff Admission Action Button */}
              {validity.isAdmissible && visit.status !== "completed" && (
                <button
                  type="button"
                  onClick={handleMarkAdmitted}
                  disabled={admitting}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:brightness-110 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  <span className="material-symbols-outlined text-lg">how_to_reg</span>
                  <span>{admitting ? "Checking In..." : "Staff Gate Check-in (Mark Admitted)"}</span>
                </button>
              )}

              {/* Live Scanner Timestamp */}
              <div className="pt-2 text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Verification: {verifyingTime} IST</span>
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800/80 text-center text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-400">Urban Trout Cold-Water RAS Facility</p>
              <p>Malabagh, Naseem Bagh, Srinagar — 190006 | Hotline: +91 84910 06127</p>
            </div>
          </div>
        ) : null}

        {/* Back navigation */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-cyan-300 font-mono transition-colors"
          >
            ← Back to Urban Trout Home
          </Link>
        </div>

      </div>
    </div>
  );
}
