"use client";
import { useState, useEffect } from "react";
import { calculateTroutNutrition } from "@/lib/nutrition";

interface NutritionModalProps {
  isOpen: boolean;
  onClose: () => void;
  kg: number;
  isGutted?: boolean;
}

export default function NutritionModal({
  isOpen,
  onClose,
  kg,
  isGutted = true,
}: NutritionModalProps) {
  const [activeTab, setActiveTab] = useState<"protein" | "omega3" | "vitd" | "comparison" | "purity">("protein");

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validKg = Math.max(1, Number(kg) || 2);
  const nutrition = calculateTroutNutrition(validKg, isGutted);
  const edibleMeatGrams = Math.round(validKg * (isGutted ? 850 : 750));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
        onClick={onClose}
      />

      {/* Main Flash Card Container */}
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden border border-cyan-500/35 shadow-[0_0_60px_rgba(6,182,212,0.25)] transition-all transform scale-100 z-10"
        style={{
          background: "linear-gradient(165deg, #051622 0%, #082030 50%, #030e16 100%)",
        }}
      >
        {/* Glow Accents */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative px-5 sm:px-7 pt-6 pb-4 border-b border-cyan-900/40 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-[10px] font-mono font-bold tracking-wider text-cyan-300 uppercase mb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Glacier Aquaculture • Nutritional Blueprint
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-['Space_Grotesk'] tracking-tight flex items-center gap-2">
              <span>The Nutrition Game</span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40">
                100% Fact-Checked
              </span>
            </h2>
            <p className="text-xs text-slate-300 font-['Manrope'] mt-1">
              Why cold-water Srinagar rainbow trout is Kashmir&apos;s ultimate muscle, heart &amp; immunity fuel.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-950/30 transition-all flex-shrink-0 cursor-pointer"
            aria-label="Close nutrition science modal"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Live Catch Metric Hero Strip */}
        <div className="px-5 sm:px-7 py-3 bg-cyan-950/40 border-b border-cyan-800/25 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-mono text-cyan-200 font-bold flex items-center gap-1.5">
            <span>📦</span> Your {validKg} Kg Catch Delivers:
          </span>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-cyan-300 font-bold bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-500/30">
              ~{nutrition.proteinGrams}g Protein
            </span>
            <span className="text-emerald-300 font-bold bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/30">
              ~{(nutrition.omega3Mg / 1000).toFixed(1)}g EPA+DHA
            </span>
            <span className="text-amber-300 font-bold bg-amber-950/90 px-2 py-0.5 rounded border border-amber-500/30">
              ~{nutrition.vitaminDIU.toLocaleString("en-IN")} IU D3
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 sm:px-7 pt-3 pb-1 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: "protein", label: "🥩 Protein & Eggs", desc: "Bioavailability" },
            { id: "omega3", label: "🧠 Glacier Omega-3", desc: "EPA & DHA" },
            { id: "vitd", label: "☀️ Sunshine D3", desc: "Immunity" },
            { id: "comparison", label: "⚖️ Trout vs Others", desc: "Comparison" },
            { id: "purity", label: "🏔️ Himalayan Purity", desc: "Origin" },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                    : "text-slate-400 hover:text-cyan-300 hover:bg-slate-800/50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-5 sm:px-7 py-5 overflow-y-auto space-y-4 max-h-[60vh] text-slate-200">
          {/* TAB 1: PROTEIN SCIENCE & EDIBLE YIELD */}
          {activeTab === "protein" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-cyan-300 font-['Space_Grotesk']">
                    The Science of Net Edible Protein Yield
                  </h3>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    USDA Benchmark #15240
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-['Manrope']">
                  Raw rainbow trout muscle contains <strong>~20.5g of pure protein per 100g</strong>. When buying whole gutted trout, about 15% is head, skin, and spine. Here is how your {validKg} Kg catch breaks down:
                </p>

                {/* Mathematical Flow */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Gross Weight</span>
                    <strong className="text-lg font-bold text-white font-['Space_Grotesk']">{validKg} Kg (2,000g)</strong>
                    <span className="text-[9px] text-slate-500 block">Gutted whole fish</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">~85% Edible Meat</span>
                    <strong className="text-lg font-bold text-cyan-300 font-['Space_Grotesk']">~{edibleMeatGrams}g</strong>
                    <span className="text-[9px] text-cyan-500/80 block">Pure cooked muscle yield</span>
                  </div>

                  <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-center">
                    <span className="text-[10px] uppercase font-mono text-cyan-300 block">Pure Protein Yield</span>
                    <strong className="text-lg font-bold text-emerald-400 font-['Space_Grotesk']">~{nutrition.proteinGrams}g</strong>
                    <span className="text-[9px] text-emerald-300 block">100% bioavailable protein</span>
                  </div>
                </div>
              </div>

              {/* Equivalency Flash Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                    🥚
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Whole Egg Equivalent</span>
                    <strong className="text-base text-amber-300 font-bold font-['Space_Grotesk']">
                      ≈ {nutrition.wholeEggEquivalent} Whole Eggs
                    </strong>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Based on standard 6g protein per large whole egg without the cholesterol load.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                    🍗
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Chicken Breast Equivalent</span>
                    <strong className="text-base text-rose-300 font-bold font-['Space_Grotesk']">
                      ≈ {nutrition.chickenBreastEquivalent} Chicken Breasts
                    </strong>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Based on 31g protein per medium cooked chicken breast, with superior cold-water digestibility.
                    </p>
                  </div>
                </div>
              </div>

              {/* Digestibility Fact */}
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-slate-300">
                <span className="text-base">💡</span>
                <div>
                  <strong className="text-emerald-300">Rapid 45-Minute Digestibility:</strong> Unlike dense red meat or poultry which takes 3 to 4 hours to digest, cold-water trout has a delicate, short-fiber collagen structure that assimilates within 45–60 minutes—ideal for athletic recovery.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GLACIER OMEGA-3s */}
          {activeTab === "omega3" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-emerald-300 font-['Space_Grotesk']">
                    The Glacier Antifreeze: Pristine EPA &amp; DHA
                  </h3>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/40 font-bold">
                    ~{(nutrition.omega3Mg / 1000).toFixed(1)}g per catch
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-['Manrope']">
                  Rainbow trout thrive in sub-zero Himalayan glacier streams. To stay flexible in freezing waters, their biology synthesizes ultra-potent polyunsaturated fatty acids: <strong>EPA (Eicosapentaenoic Acid)</strong> and <strong>DHA (Docosahexaenoic Acid)</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                    <span>🧠</span> Brain &amp; Cognitive Clarity
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    DHA constitutes over 40% of the polyunsaturated fatty acids in the human brain. Cold-water trout DHA directly crosses the blood-brain barrier for enhanced mental focus.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-rose-300 font-mono flex items-center gap-1.5">
                    <span>❤️</span> Cardiovascular Protection
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    EPA actively reduces arterial plaque buildup, lowers blood triglycerides by up to 25%, and maintains natural microvascular elasticity.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-cyan-500/20 text-xs text-slate-300 space-y-1">
                <strong className="text-cyan-300 font-mono">The Plant vs. Trout Truth:</strong>
                <p className="text-[11px] text-slate-400">
                  Plant omega-3s (ALA in walnuts or chia seeds) have an extremely low human conversion rate of only 3% to 5% into active EPA/DHA. Trout delivers <strong>100% direct, pre-formed marine EPA/DHA</strong>.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: VITAMIN D3 */}
          {activeTab === "vitd" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-amber-300 font-['Space_Grotesk']">
                    Natural Himalayan Sunshine Vitamin (D3)
                  </h3>
                  <span className="text-[11px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded-full border border-amber-500/40 font-bold">
                    ~{nutrition.vitaminDIU.toLocaleString("en-IN")} IU Total
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-['Manrope']">
                  Almost no whole food in modern grocery stores contains significant Vitamin D. Cold-water rainbow trout is one of the world&apos;s few true natural super-sources, delivering <strong>~540 IU of bioavailable D3 per 100g</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                  <span className="text-xl block mb-1">🛡️</span>
                  <strong className="text-xs text-amber-300 block font-mono">Deep Immunity</strong>
                  <p className="text-[10px] text-slate-400 mt-1">Upregulates T-cells and antimicrobial peptides against seasonal flu and winter chill.</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                  <span className="text-xl block mb-1">🦴</span>
                  <strong className="text-xs text-amber-300 block font-mono">Bone Density</strong>
                  <p className="text-[10px] text-slate-400 mt-1">Crucial for intestinal calcium absorption, joint health, and preventing osteopenia.</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center">
                  <span className="text-xl block mb-1">⚡</span>
                  <strong className="text-xs text-amber-300 block font-mono">Natural Fat Matrix</strong>
                  <p className="text-[10px] text-slate-400 mt-1">Since D3 is fat-soluble, it absorbs seamlessly with trout&apos;s healthy omega fats.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HEAD-TO-HEAD COMPARISON */}
          {activeTab === "comparison" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                      <th className="p-3">Nutrient / Metric</th>
                      <th className="p-3 text-cyan-300 font-bold bg-cyan-950/40">Rainbow Trout</th>
                      <th className="p-3 text-slate-300">Chicken Breast</th>
                      <th className="p-3 text-slate-300">Whole Eggs (x2)</th>
                      <th className="p-3 text-slate-300">Mutton / Lamb</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-[11px]">
                    <tr>
                      <td className="p-3 font-semibold text-slate-300">Protein / 100g</td>
                      <td className="p-3 text-cyan-300 font-bold bg-cyan-950/20">~20.5g (Light fiber)</td>
                      <td className="p-3 text-slate-400">~22g</td>
                      <td className="p-3 text-slate-400">~12.5g</td>
                      <td className="p-3 text-slate-400">~17g</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-300">Omega-3 (EPA/DHA)</td>
                      <td className="p-3 text-emerald-400 font-bold bg-cyan-950/20">~850mg (Exceptional)</td>
                      <td className="p-3 text-slate-400">&lt; 50mg (Negligible)</td>
                      <td className="p-3 text-slate-400">~100mg</td>
                      <td className="p-3 text-slate-400">&lt; 80mg</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-300">Natural Vitamin D3</td>
                      <td className="p-3 text-amber-300 font-bold bg-cyan-950/20">~540 IU (Very High)</td>
                      <td className="p-3 text-slate-400">0 IU</td>
                      <td className="p-3 text-slate-400">~80 IU</td>
                      <td className="p-3 text-slate-400">0 IU</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-300">Digestibility Speed</td>
                      <td className="p-3 text-cyan-300 font-bold bg-cyan-950/20">45 - 60 mins</td>
                      <td className="p-3 text-slate-400">2 - 3 hours</td>
                      <td className="p-3 text-slate-400">1.5 - 2 hours</td>
                      <td className="p-3 text-slate-400">4 - 5 hours</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-300">Carbs &amp; Sugar</td>
                      <td className="p-3 text-emerald-400 font-bold bg-cyan-950/20">0g (100% Keto)</td>
                      <td className="p-3 text-slate-400">0g</td>
                      <td className="p-3 text-slate-400">~1g</td>
                      <td className="p-3 text-slate-400">0g</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: HIMALAYAN PURITY */}
          {activeTab === "purity" && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-2">
                <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider block">
                  🏔️ The Urban Trout Glacier Standard
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-['Manrope']">
                  Unlike warm-water river fish or ocean salmon exposed to industrial microplastics, Urban Trout is reared in pristine spring waters sourced from high-altitude glacier melt in Kashmir.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="font-bold text-emerald-300 font-mono flex items-center gap-1.5">
                    <span>✓</span> Zero Antibiotics
                  </span>
                  <p className="text-[11px] text-slate-400">
                    High water flow and continuous oxygenation naturally eliminate bacterial pathogens without preventive drugs.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="font-bold text-emerald-300 font-mono flex items-center gap-1.5">
                    <span>✓</span> Sub-Zero Thermal Pack
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Dispatched in 100% bio-thermal insulated boxes with ice gel to lock in cellular moisture and freshness.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-7 py-4 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Srinagar Cold-Water Fresh</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold text-xs font-['Space_Grotesk'] uppercase tracking-wider hover:opacity-95 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.35)] cursor-pointer"
          >
            Got It • Back to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
