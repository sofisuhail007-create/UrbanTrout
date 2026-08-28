"use client";
import { useState, useTransition } from "react";
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
  { id: "morning", label: "Morning Slot", time: "10:00 AM – 12:00 PM", icon: "wb_sunny", desc: "Best for morning harvest viewing" },
  { id: "afternoon", label: "Afternoon Slot", time: "12:00 PM – 03:00 PM", icon: "light_mode", desc: "Optimal sunlight & active feeding" },
  { id: "evening", label: "Evening Slot", time: "03:00 PM – 06:00 PM", icon: "wb_twilight", desc: "Cool evening fresh catch pickup" },
  { id: "flexible", label: "Flexible Timing", time: "Anytime (08:00 AM – 07:00 PM)", icon: "schedule", desc: "Visit whenever convenient" },
];

const GUEST_OPTIONS = [
  { value: 1, label: "1 Person", sub: "Solo visit" },
  { value: 2, label: "2 - 3 People", sub: "Couple / Friends" },
  { value: 4, label: "4 - 6 People", sub: "Family group" },
  { value: 8, label: "7+ People", sub: "Group / Educational" },
];

const PURPOSES = [
  { id: "purchase", label: "🐟 Live Trout Purchase", desc: "Pick & weigh fresh fish live from tanks" },
  { id: "family_tour", label: "👨‍👩‍👧 Family Outing & Tour", desc: "See clean-water RAS tanks & trout feeding" },
  { id: "bulk_commercial", label: "📦 Restaurant / Bulk Sourcing", desc: "Commercial wholesale supply inquiry" },
  { id: "educational", label: "🔬 Aquaculture & Tech Learning", desc: "Learn about recirculating cold-water systems (RAS)" },
];

const FAQS = [
  {
    q: "Is there any entry fee to visit the farm?",
    a: "No, visiting Urban Trout Farm and viewing our RAS facility is 100% free of charge! We welcome families, seafood lovers, and aquaculture enthusiasts.",
  },
  {
    q: "Can I buy and take home freshly harvested trout on-site?",
    a: "Absolutely! You can choose live Rainbow Trout straight from our cold-water RAS tanks. Our staff will net them, weigh them live, and gut/clean them on the spot, packing them in crushed ice for your trip home.",
  },
  {
    q: "Why should I pre-notify my visit?",
    a: "Pre-notifying helps our farm team dedicate staff to guide your tour, ensure specific fish size availability, and prepare live harvest demonstrations without any wait time.",
  },
  {
    q: "What if my schedule changes or I'm running late?",
    a: "No worries at all! Just ping us on WhatsApp (+91 84910 06127) or call our farm hotline, and we will happily adjust your time slot.",
  },
  {
    q: "Is the farm accessible for children and senior citizens?",
    a: "Yes. Our facility in Malabagh, Naseem Bagh is located right beside the road with dedicated on-site parking and safe paved facility walkways.",
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedVisit, setSubmittedVisit] = useState<any | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Quick date helper
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
    if (!visitDate) {
      toast.error("Please pick a visit date.");
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
          email: email.trim() || undefined,
          visit_date: visitDate,
          time_slot: timeSlot,
          guest_count: guestCount,
          visit_purpose: visitPurpose,
          special_requests: specialRequests.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit farm visit.");
      }

      setSubmittedVisit(data.visit);
      toast.success("Farm visit pre-notified successfully! See you at the farm.");
      window.scrollTo({ top: 300, behavior: "smooth" });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Could not submit visit. Please try WhatsApp.");
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
            background: "radial-gradient(circle, rgba(114,221,253,0.07) 0%, rgba(16,185,129,0.03) 40%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ─── Hero Header ─── */}
        <div className="text-center max-w-3xl mx-auto mb-14 md:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Direct Farm Experience • Malabagh, Naseem Bagh
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
            Pre-Notify Your <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300">
              Farm Visit
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
            Experience Kashmir’s cold-water trout aquaculture first-hand. Walk along our clean-water RAS culture tanks, see thousands of active Rainbow Trout, and pick live fish harvested on the spot.
          </p>

          {/* Key Value Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 mt-7">
            {[
              { icon: "verified", text: "100% Free Entry" },
              { icon: "water_drop", text: "Deep Borewell Water" },
              { icon: "set_meal", text: "Live Weight & Clean" },
              { icon: "schedule", text: "Daily 8 AM – 7 PM" },
            ].map((badge, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300"
                style={{ background: "rgba(16,33,44,0.7)", border: "1px solid rgba(114,221,253,0.15)" }}
              >
                <span className="material-symbols-outlined text-[16px] text-cyan-400">{badge.icon}</span>
                <span>{badge.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Main Content Grid (Form + Highlights) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* ── LEFT COLUMN (7 Cols): The Pre-Notification Form OR Success Confirmation ── */}
          <div className="lg:col-span-7">
            {submittedVisit ? (
              /* Success Confirmation Card */
              <div
                className="rounded-3xl p-6 sm:p-8 relative overflow-hidden text-center"
                style={{
                  background: "linear-gradient(145deg, #0b1e2a 0%, #06151e 100%)",
                  border: "1px solid rgba(114,221,253,0.3)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>

                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 font-mono">
                  Pre-Notification Confirmed
                </span>

                <h3
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  className="text-2xl sm:text-3xl font-extrabold text-white mt-2 mb-3"
                >
                  We Look Forward to Seeing You, {submittedVisit.visitor_name}!
                </h3>

                <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-sm text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
                  Your visit has been registered in our farm schedule. Our farm team in Naseem Bagh will be ready to welcome you.
                </p>

                {/* Visit summary box */}
                <div
                  className="rounded-2xl p-4 sm:p-5 text-left mb-6 space-y-3"
                  style={{ background: "#031018", border: "1px solid rgba(114,221,253,0.15)" }}
                >
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-800 text-xs">
                    <span className="text-slate-400">Reference ID:</span>
                    <span className="font-mono text-cyan-400 font-bold">{submittedVisit.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Date of Visit</span>
                      <span className="text-slate-200 font-semibold text-sm">{submittedVisit.visit_date}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Time Slot</span>
                      <span className="text-slate-200 font-semibold text-sm">{submittedVisit.time_slot}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Group Size</span>
                      <span className="text-slate-200 font-semibold">{submittedVisit.guest_count} Person(s)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Purpose</span>
                      <span className="text-slate-200 font-semibold">{submittedVisit.visit_purpose}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                  <a
                    href={`https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20I%20pre-notified%20my%20farm%20visit%20for%20${encodeURIComponent(submittedVisit.visit_date)}%20(${encodeURIComponent(submittedVisit.time_slot)}).%20Reference:%20${submittedVisit.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                    </svg>
                    Send on WhatsApp
                  </a>

                  <a
                    href="https://maps.google.com/?q=34.144709,74.824525"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-xs font-bold uppercase tracking-wider text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all"
                  >
                    <span className="material-symbols-outlined text-base">directions</span>
                    Get Google Maps Route
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setSubmittedVisit(null)}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Schedule Another Visit
                </button>
              </div>
            ) : (
              /* Pre-Notification Form */
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
                      Pre-Notification Form
                    </h2>
                    <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs text-slate-400 mt-0.5">
                      Takes 30 seconds • No payment or advance fee needed
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20">
                    Step 1 of 1
                  </span>
                </div>

                {/* 1. Personal Information */}
                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    1. Your Contact Details
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
                        Phone / WhatsApp Number <span className="text-red-400">*</span>
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
                      Email Address <span className="text-slate-500 font-normal">(Optional for confirmation receipt)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors"
                      style={{ fontFamily: '"Manrope", sans-serif' }}
                    />
                  </div>
                </div>

                {/* 2. Date & Time Selection */}
                <div className="space-y-4 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    2. Choose Date &amp; Time Slot
                  </span>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Visit Date <span className="text-red-400">*</span>
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
                      Preferred Time Slot <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {TIME_SLOTS.map((slot) => {
                        const isSelected = timeSlot === slot.time;
                        return (
                          <div
                            key={slot.id}
                            onClick={() => setTimeSlot(slot.time)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                              isSelected
                                ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10"
                                : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            <span className={`material-symbols-outlined text-lg mt-0.5 ${isSelected ? "text-cyan-400" : "text-slate-500"}`}>
                              {slot.icon}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-200">{slot.label}</span>
                                {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400" />}
                              </div>
                              <span className="text-[11px] font-mono text-cyan-300 block">{slot.time}</span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">{slot.desc}</span>
                            </div>
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
                      Total Guests / Visitors
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                      Primary Purpose of Visit
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
                      Special Requests / Notes <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Planning to buy 4-5 kg gutted trout, bringing family for live tank tour..."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                      style={{ fontFamily: '"Manrope", sans-serif' }}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Pre-Notifying Farm Team...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Farm Visit Pre-Notification</span>
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-slate-500 mt-2.5" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    🔒 We respect your privacy. No advance payment or login needed.
                  </p>
                </div>
              </form>
            )}
          </div>

          {/* ── RIGHT COLUMN (5 Cols): Highlights, Location & Guidelines ── */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 1. What to Expect Card */}
            <div
              className="rounded-3xl p-6 sm:p-7 relative overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #0f2432 0%, #06151e 100%)",
                border: "1px solid rgba(114,221,253,0.15)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-cyan-400 text-xl">psychiatry</span>
                <h3
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                  className="text-lg font-bold text-white"
                >
                  What You&apos;ll Experience
                </h3>
              </div>

              <div className="space-y-4">
                {[
                  {
                    icon: "water",
                    title: "Crystal Cold-Water RAS Tanks",
                    desc: "See thousands of active Rainbow Trout swimming against high-velocity, deep borewell-fed fresh water currents in modern recirculating aquaculture tanks.",
                  },
                  {
                    icon: "scale",
                    title: "Live Netting & Custom Gutting",
                    desc: "Pick your fish live. We net, weigh, gut, wash, and pack in crushed ice right in front of your eyes.",
                  },
                  {
                    icon: "family_restroom",
                    title: "Family & Educational Outing",
                    desc: "Children and adults can learn how recirculating aquaculture systems maintain pure zero-antibiotic fish.",
                  },
                  {
                    icon: "verified_user",
                    title: "Freshness Guaranteed",
                    desc: "No cold-storage thawing. The fish you take home was swimming minutes before packing.",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
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
                    className="text-lg font-bold text-white"
                  >
                    Farm Location &amp; Hours
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase font-mono">
                  Open Today
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300 mb-5" style={{ fontFamily: '"Manrope", sans-serif' }}>
                <p className="font-semibold text-white">Urban Trout Farm &amp; Live Vending Center</p>
                <p className="text-slate-400">Malabagh, Naseem Bagh, Srinagar — 190006</p>
                <p className="text-slate-500 text-[11px]">Landmark: Near R P School (Girls Wing)</p>
                <div className="pt-2 flex items-center gap-2 text-cyan-400 font-mono text-xs">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  <span>Daily Timings: 08:00 AM – 07:00 PM</span>
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

            {/* 3. Bio-Security & Safety Guidelines */}
            <div
              className="rounded-3xl p-5 sm:p-6"
              style={{
                background: "rgba(11,27,37,0.5)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 font-mono">
                <span className="material-symbols-outlined text-sm text-amber-400">shield</span>
                Visiting Guidelines &amp; Bio-Security
              </h4>
              <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc list-inside leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
                <li>Step on the sanitizing mat when entering the RAS culture area.</li>
                <li>Please do not throw external food or objects into the trout tanks.</li>
                <li>Wear flat, non-slip footwear near the wet tank walkways.</li>
                <li>Children must be closely accompanied around the deeper tanks.</li>
              </ul>
            </div>

          </div>
        </div>

        {/* ─── Photo / Experience Highlights ─── */}
        <div className="mt-20 pt-12 border-t border-slate-800/80">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 font-mono block mb-2">
              On-Site Glimpse
            </span>
            <h3
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              From Our Tanks to Your Kitchen
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="text-3xl">🐟</div>
              <h4 style={{ fontFamily: '"Space Grotesk", sans-serif' }} className="text-base font-bold text-white">
                Live Trout RAS Tanks
              </h4>
              <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs text-slate-400 leading-relaxed">
                Our recirculating tanks are supplied with pure underground borewell water, filtered to perfection and continuously oxygenated.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="text-3xl">🔪</div>
              <h4 style={{ fontFamily: '"Space Grotesk", sans-serif' }} className="text-base font-bold text-white">
                Live Gutting &amp; Scaling
              </h4>
              <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs text-slate-400 leading-relaxed">
                Our skilled cutting team prepares and guts your chosen fish on the spot, washing it with filtered cold water.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="text-3xl">🧊</div>
              <h4 style={{ fontFamily: '"Space Grotesk", sans-serif' }} className="text-base font-bold text-white">
                Crushed Ice Thermal Packing
              </h4>
              <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs text-slate-400 leading-relaxed">
                Fish is packed in food-grade thermal ice boxes, keeping it pristine cold throughout your drive back home.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Frequently Asked Questions ─── */}
        <div className="mt-20 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 font-mono block mb-2">
              Common Questions
            </span>
            <h3
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              Farm Visit FAQs
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
            Prefer Delivery Straight to Your Doorstep?
          </h3>
          <p style={{ fontFamily: '"Manrope", sans-serif' }} className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mb-6">
            If you cannot visit the farm in person, order online for same-day chilled home delivery across Srinagar within a 5km radius.
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
