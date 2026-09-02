"use client";
import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

const C = {
  bg: "#031018",
  bgLow: "#06151e",
  bgHigh: "#10212c",
  bgHighest: "#152834",
  primary: "#72ddfd",
  primaryCont: "#3aadcc",
  onPrimCont: "#002730",
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
  outline: "#6a7782",
  outlineVar: "#3d4a53",
};

const TIME_SLOTS = [
  {
    id: "batch_morning",
    label: "Morning Batch",
    time: "10:30 AM – 11:30 AM",
    icon: "wb_sunny",
    desc: "Morning harvest demonstration & tank inspection window",
  },
  {
    id: "batch_afternoon",
    label: "Afternoon Batch",
    time: "02:00 PM – 03:00 PM",
    icon: "light_mode",
    desc: "Post-feeding tour & recirculating bio-filter walkthrough",
  },
  {
    id: "batch_evening",
    label: "Evening Batch",
    time: "04:30 PM – 05:30 PM",
    icon: "wb_twilight",
    desc: "Evening fresh catch harvesting & on-site cleaning",
  },
];

const GUEST_OPTIONS = [
  { value: 1, label: "1 Person", sub: "Solo buyer" },
  { value: 2, label: "2 - 3 People", sub: "Couple / Family" },
  { value: 4, label: "4 - 5 People", sub: "Small group (Max)" },
];

const PURPOSES = [
  { id: "purchase", label: "🐟 Fresh Trout Sourcing & Packaging", desc: "Select fresh Rainbow Trout prepared straight from the farm" },
  { id: "family_tour", label: "👨‍👩‍👧 Family Educational Tour", desc: "Learn about cold-water RAS aquaculture & fish welfare" },
  { id: "bulk_commercial", label: "📦 Restaurant / Commercial Sourcing", desc: "Bulk wholesale inquiry & harvest schedule alignment" },
  { id: "educational", label: "🔬 Aquaculture & Tech Study", desc: "Inspect filtration, oxygen cones & water parameters" },
];

const FAQS = [
  {
    q: "Why is prior Farm Manager approval mandatory for all visits?",
    a: "Urban Trout operates a high-density, bio-secure Recirculating Aquaculture System (RAS). Uncontrolled walk-ins or random timings disrupt automated oxygen injection, feeding cycles, and risk pathogen contamination. Our Farm Manager reviews every request to ensure biosecurity and dedicated staff guidance.",
  },
  {
    q: "How will I know if my visit is approved?",
    a: "Once you submit your request, the Farm Manager will review the tank schedule. If approved, you will receive an official Visit Approval Pass via Email and WhatsApp with your confirmed time slot, directions, and rules.",
  },
  {
    q: "Can I buy fresh trout on the spot during an approved visit?",
    a: "Yes! During your approved slot, our farm team will harvest your selected fresh trout directly, weigh it, and expertly gut/clean and pack it chilled in food-grade ice for you.",
  },
  {
    q: "What happens if I arrive without an approved email pass?",
    a: "To protect the biological safety of our trout, entry into the RAS culture building is strictly prohibited without an official approval pass.",
  },
  {
    q: "What bio-security rules must I follow on the farm?",
    a: "All visitors must step on the disinfectant foot mat upon entry, stay on designated walkways, never touch the water or put anything into the tanks, and ensure children are held by hand at all times.",
  },
];

export default function FarmVisitsPage() {
  const [visitorName, setVisitorName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [visitDate, setVisitDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0].time);
  const [guestCount, setGuestCount] = useState(2);
  const [visitPurpose, setVisitPurpose] = useState(PURPOSES[0].label);
  const [specialRequests, setSpecialRequests] = useState("");
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedVisit, setSubmittedVisit] = useState<any | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const setQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setVisitDate(d.toISOString().split("T")[0]);
  };

  const getTodayStr = () => new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("A valid Email is required to receive your Farm Approval Pass.");
      return;
    }
    if (!visitDate) {
      toast.error("Please select a date for your visit request.");
      return;
    }
    if (!agreedToRules) {
      toast.error("Please confirm adherence to the strict RAS Bio-Security rules.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/farm-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_name: visitorName.trim(),
          phone: cleanPhone,
          email: email.trim(),
          visit_date: visitDate,
          time_slot: timeSlot,
          guest_count: guestCount,
          visit_purpose: visitPurpose,
          special_requests: specialRequests.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit farm visit request.");
      }

      setSubmittedVisit(data.visit);
      toast.success("Visit request submitted! Awaiting Farm Manager review.");
      window.scrollTo({ top: 250, behavior: "smooth" });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Could not submit request. Please try WhatsApp.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="pb-24 pt-28 md:pt-36">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: "15%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "500px",
            background: "radial-gradient(circle, rgba(114,221,253,0.06) 0%, rgba(251,191,36,0.03) 40%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ─── Hero Header ─── */}
        <div className="text-center max-w-3xl mx-auto mb-14 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Strict Bio-Security Facility • Prior Approval Mandatory
          </div>

          <h1
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: "clamp(2.4rem, 5.5vw, 4.2rem)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              color: C.onSurface,
            }}
            className="mb-5"
          >
            Request a <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300">
              Farm Visit Pass
            </span>
          </h1>

          <p
            style={{
              fontFamily: '"Manrope", sans-serif',
              fontSize: "1.05rem",
              color: C.onSurfVar,
              lineHeight: 1.75,
            }}
            className="max-w-2xl mx-auto"
          >
            Urban Trout operates a high-density, bio-secure <strong>Recirculating Aquaculture System (RAS)</strong>. To protect fish health and avoid disrupting feeding cycles, all farm visits are strictly controlled by our <strong>Farm Manager</strong>.
          </p>

          {/* Strict Policy Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 mt-7">
            {[
              { icon: "verified_user", text: "Prior Approval Required" },
              { icon: "mark_email_read", text: "Pass Sent via Email" },
              { icon: "schedule", text: "Fixed 1-Hour Batches" },
              { icon: "sanitizer", text: "Mandatory Foot Dip" },
            ].map((badge, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300"
                style={{ background: "rgba(16,33,44,0.7)", border: "1px solid rgba(114,221,253,0.15)" }}
              >
                <span className="material-symbols-outlined text-[16px] text-cyan-400">{badge.icon}</span>
                <span>{badge.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Main Content Grid (Form + Strict Guidelines) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* ── LEFT COLUMN (7 Cols): Request Form OR Awaiting Approval Card ── */}
          <div className="lg:col-span-7">
            {submittedVisit ? (
              /* Awaiting Approval State Card */
              <div
                className="rounded-3xl p-6 sm:p-8 relative overflow-hidden text-center space-y-5"
                style={{
                  background: "linear-gradient(145deg, #10212c 0%, #06151e 100%)",
                  border: "1px solid rgba(251,191,36,0.4)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                  <span className="material-symbols-outlined text-3xl animate-pulse">hourglass_top</span>
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-widest font-mono inline-block">
                    Request Under Farm Manager Review
                  </span>

                  <h3
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    className="text-2xl sm:text-3xl font-extrabold text-white mt-3 mb-2"
                  >
                    Application Received, {submittedVisit.visitor_name}!
                  </h3>

                  <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                    Your visit application has been submitted to the Farm Manager. We are reviewing tank biological parameters and feeding schedules.
                  </p>
                </div>

                {/* Important Strict Warning Box */}
                <div
                  className="rounded-2xl p-4 text-left space-y-2"
                  style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}
                >
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono uppercase">
                    <span className="material-symbols-outlined text-base">warning</span>
                    <span>Action Required Before Visiting:</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    Please <strong>do not travel to the farm yet</strong>. You will receive an official <strong>Visit Approval Pass via Email</strong> (<code className="text-cyan-300">{submittedVisit.email}</code>) once the Farm Manager approves your slot.
                  </p>
                </div>

                {/* Visit summary box */}
                <div
                  className="rounded-2xl p-4 text-left space-y-2.5 text-xs"
                  style={{ background: "#031018", border: "1px solid rgba(114,221,253,0.15)" }}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Application Reference:</span>
                    <span className="font-mono text-cyan-400 font-bold">{submittedVisit.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Requested Date</span>
                      <span className="text-slate-200 font-semibold text-sm">{submittedVisit.visit_date}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Requested Batch</span>
                      <span className="text-slate-200 font-semibold text-sm">{submittedVisit.time_slot}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Group Size</span>
                      <span className="text-slate-200 font-semibold">{submittedVisit.guest_count} Person(s)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Purpose</span>
                      <span className="text-slate-200 font-semibold truncate">{submittedVisit.visit_purpose}</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp button */}
                <div className="pt-2">
                  <a
                    href={`https://wa.me/918491006127?text=Hi%20Farm%20Manager!%20I%20have%20submitted%20a%20visit%20request%20for%20${encodeURIComponent(submittedVisit.visit_date)}%20(${encodeURIComponent(submittedVisit.time_slot)}).%20Application%20ID:%20${submittedVisit.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <span className="material-symbols-outlined text-base">chat</span>
                    <span>Contact Farm Manager on WhatsApp</span>
                  </a>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setSubmittedVisit(null)}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Submit Another Visit Request
                  </button>
                </div>
              </div>
            ) : (
              /* Request Form */
              <form
                onSubmit={handleSubmit}
                className="rounded-3xl p-6 sm:p-8 space-y-7 relative"
                style={{
                  background: "linear-gradient(160deg, #0b1b24 0%, #06151e 100%)",
                  border: "1px solid rgba(114,221,253,0.18)",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                }}
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h2
                      style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                      className="text-xl sm:text-2xl font-bold text-white"
                    >
                      Farm Visit Request Form
                    </h2>
                    <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs text-slate-400 mt-0.5">
                      Subject to Farm Manager slot availability &amp; biosecurity review
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/25">
                    Approval Required
                  </span>
                </div>

                {/* 1. Contact Info */}
                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    1. Visitor Contact Information
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Full Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Suhail Sofi"
                        value={visitorName}
                        onChange={(e) => setVisitorName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                        style={{ fontFamily: '"Manrope", sans-serif' }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Phone / WhatsApp <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 font-mono font-bold">+91</span>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          placeholder="8491006127"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-12 pr-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Email Address <span className="text-red-400">*</span> <span className="text-slate-400 font-normal">(Official Approval Pass will be emailed here)</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                      style={{ fontFamily: '"Manrope", sans-serif' }}
                    />
                  </div>
                </div>

                {/* 2. Date & Structured Batch Selection */}
                <div className="space-y-4 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    2. Choose Date &amp; Controlled Inspection Batch
                  </span>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Requested Date <span className="text-red-400">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setQuickDate(0)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate(1)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate(2)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                      >
                        In 2 Days
                      </button>
                    </div>
                    <input
                      type="date"
                      required
                      min={getTodayStr()}
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Select Inspection Batch Window <span className="text-red-400">*</span>
                    </label>
                    <div className="space-y-2.5">
                      {TIME_SLOTS.map((slot) => {
                        const isSelected = timeSlot === slot.time;
                        return (
                          <div
                            key={slot.id}
                            onClick={() => setTimeSlot(slot.time)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10"
                                : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSelected ? "bg-cyan-400 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"}`}>
                                <span className="material-symbols-outlined text-lg">{slot.icon}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-200">{slot.label}</span>
                                  <span className="text-[11px] font-mono text-cyan-400 font-semibold">({slot.time})</span>
                                </div>
                                <span className="text-[11px] text-slate-500 block mt-0.5">{slot.desc}</span>
                              </div>
                            </div>
                            <input
                              type="radio"
                              name="time_batch"
                              checked={isSelected}
                              onChange={() => setTimeSlot(slot.time)}
                              className="accent-cyan-400 w-4 h-4 cursor-pointer"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Group Size & Purpose */}
                <div className="space-y-4 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    3. Group Size &amp; Purpose
                  </span>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Total Visitors <span className="text-slate-500 font-normal">(Max 5 per batch for bio-safety)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {GUEST_OPTIONS.map((g) => {
                        const isSel = guestCount === g.value;
                        return (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => setGuestCount(g.value)}
                            className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                              isSel
                                ? "bg-cyan-500/20 border-cyan-400 text-white shadow-sm"
                                : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            <span className="text-xs font-bold block">{g.label}</span>
                            <span className="text-[10px] text-slate-500 block">{g.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Primary Purpose
                    </label>
                    <div className="space-y-2">
                      {PURPOSES.map((p) => {
                        const isSel = visitPurpose === p.label;
                        return (
                          <div
                            key={p.id}
                            onClick={() => setVisitPurpose(p.label)}
                            className={`p-2.5 px-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                              isSel
                                ? "bg-cyan-500/15 border-cyan-400 text-white"
                                : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            <div>
                              <span className="text-xs font-semibold text-slate-200 block">{p.label}</span>
                              <span className="text-[11px] text-slate-500 block">{p.desc}</span>
                            </div>
                            <input
                              type="radio"
                              name="purpose"
                              checked={isSel}
                              onChange={() => setVisitPurpose(p.label)}
                              className="accent-cyan-400 w-4 h-4 cursor-pointer"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Specific Notes / Kg Estimate <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Planning to purchase approx 4-5 kg gutted trout on-site..."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                      style={{ fontFamily: '"Manrope", sans-serif' }}
                    />
                  </div>

                  {/* Strict Bio-Security Agreement Checkbox */}
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="agree_rules"
                      required
                      checked={agreedToRules}
                      onChange={(e) => setAgreedToRules(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-amber-400 rounded cursor-pointer flex-shrink-0"
                    />
                    <label htmlFor="agree_rules" className="cursor-pointer leading-relaxed select-none">
                      <strong className="text-amber-300 block mb-0.5">Strict RAS Agreement:</strong>
                      I agree to wait for the Farm Manager&apos;s <strong>Email Approval Pass</strong> before visiting. I agree to follow all on-site biosecurity protocols (disinfection foot dips, no touching water, and arriving strictly within my approved slot).
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400 hover:brightness-110 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-cyan-500/15 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Submitting to Farm Manager...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Visit Request for Review</span>
                        <span className="material-symbols-outlined text-base">send</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-slate-500 mt-2.5" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    🔒 Decisions are typically emailed within 1–2 hours during operational hours (8 AM – 7 PM).
                  </p>
                </div>
              </form>
            )}
          </div>

          {/* ── RIGHT COLUMN (5 Cols): Strict Guidelines & Farm Rules ── */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 1. Strict Protocol Rules Card */}
            <div
              className="rounded-3xl p-6 sm:p-7 relative overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #10212c 0%, #06151e 100%)",
                border: "1px solid rgba(251,191,36,0.3)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-amber-400 text-2xl">shield_locked</span>
                <div>
                  <h3
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    className="text-base font-bold text-white"
                  >
                    Strict RAS Bio-Security Protocols
                  </h3>
                  <span className="text-[10px] text-amber-400 font-mono font-bold uppercase">Mandatory Compliance</span>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    icon: "badge",
                    title: "Farm Manager Approval Required",
                    desc: "Unapproved walk-ins are strictly prohibited from entering the culture area. All visits must have an issued Email Pass.",
                  },
                  {
                    icon: "timer",
                    title: "Strict 1-Hour Slot Adherence",
                    desc: "Visitors must arrive strictly within their approved batch window so feeding schedules and oxygenation cycles remain undisturbed.",
                  },
                  {
                    icon: "sanitizer",
                    title: "Mandatory Disinfection Foot Dip",
                    desc: "Every visitor must step on the antibacterial sanitizing foot mat before stepping onto the indoor culture floor.",
                  },
                  {
                    icon: "do_not_touch",
                    title: "Zero Water & Tank Contact",
                    desc: "Do not put hands, outside fish feeds, or any foreign objects into culture tanks under any circumstances.",
                  },
                  {
                    icon: "child_care",
                    title: "Strict Supervision of Minors",
                    desc: "Children must be held by hand at all times on paved walkways near deep culture tanks.",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-base">{item.icon}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Location & Navigation Card */}
            <div
              className="rounded-3xl p-6 sm:p-7 relative overflow-hidden"
              style={{
                background: "#06151e",
                border: "1px solid rgba(114,221,253,0.12)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-xl">location_on</span>
                  <h3
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    className="text-base font-bold text-white"
                  >
                    Farm Facility &amp; Location
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase font-mono">
                  Srinagar
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300 mb-5" style={{ fontFamily: '"Manrope", sans-serif' }}>
                <p className="font-semibold text-white">Urban Trout Farm &amp; Fresh Fish Counter</p>
                <p className="text-slate-400">Malabagh, Naseem Bagh, Srinagar — 190006</p>
                <p className="text-slate-500 text-[11px]">Landmark: Near R P School (Girls Wing)</p>
                <div className="pt-2 flex items-center gap-2 text-cyan-400 font-mono text-xs">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  <span>Operational Hours: 08:00 AM – 07:00 PM</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <a
                  href="https://maps.google.com/?q=34.144709,74.824525"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-3.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center"
                >
                  <span className="material-symbols-outlined text-base">directions</span>
                  Open Google Maps
                </a>
                <a
                  href="tel:+918491006127"
                  className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-base">call</span>
                  +91 84910 06127
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* ─── Frequently Asked Questions ─── */}
        <div className="mt-20 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 font-mono block mb-2">
              Visit Guidelines &amp; Approvals
            </span>
            <h3
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border transition-all overflow-hidden"
                  style={{
                    background: isOpen ? "rgba(16,33,44,0.8)" : "rgba(6,21,30,0.6)",
                    borderColor: isOpen ? "rgba(114,221,253,0.3)" : "rgba(61,74,83,0.3)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span
                      style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                      className="text-sm sm:text-base font-semibold text-slate-200"
                    >
                      {faq.q}
                    </span>
                    <span className={`material-symbols-outlined text-cyan-400 text-lg transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3" style={{ fontFamily: '"Manrope", sans-serif' }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Bottom CTA ─── */}
        <div
          className="mt-20 rounded-3xl p-8 text-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0b2230 0%, #031018 100%)",
            border: "1px solid rgba(114,221,253,0.25)",
          }}
        >
          <h3
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
            className="text-xl sm:text-2xl font-bold text-white mb-2"
          >
            Need Same-Day Fresh Trout Delivered to Your Door?
          </h3>
          <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mb-6">
            Skip the visit and order fresh chilled Rainbow Trout harvested to order with same-day home delivery across Srinagar within a 5km radius.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 py-3 px-6 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20"
          >
            <span>Order Fresh Catch Online</span>
            <span className="material-symbols-outlined text-base">shopping_bag</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
