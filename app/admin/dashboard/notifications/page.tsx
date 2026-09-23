"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/adminClient";
import toast from "react-hot-toast";

interface SubscriberStats {
  totalSubscribers: number;
  sampleSubscribers: any[];
}

function getDeviceLabel(ua?: string) {
  if (!ua) return "Connected Device";
  if (/iphone/i.test(ua)) return "📱 Apple iPhone (iOS PWA)";
  if (/ipad/i.test(ua)) return "📱 Apple iPad (iOS PWA)";
  if (/android/i.test(ua)) return "🤖 Android Device";
  if (/windows/i.test(ua)) return "💻 Windows PC (Chrome/Edge)";
  if (/macintosh|mac os x/i.test(ua)) return "💻 Apple Mac (Safari/Chrome)";
  return "🌐 Web Browser Device";
}

export interface MarketingTemplate {
  id: string;
  name: string;
  icon: string;
  category: "wit" | "weather" | "dinner" | "fitness" | "fomo" | "weekend";
  tag: string;
  title: string;
  body: string;
  url: string;
}

const CATEGORIES = [
  { id: "all", label: "All Strategies", icon: "✨" },
  { id: "wit", label: "Zomato Wit", icon: "🔥" },
  { id: "weather", label: "Mausam & Srinagar", icon: "🌧️" },
  { id: "dinner", label: "Meal Rush", icon: "🍽️" },
  { id: "fitness", label: "Gym & Protein", icon: "💪" },
  { id: "fomo", label: "Flash & FOMO", icon: "⚡" },
  { id: "weekend", label: "Weekend & Feasts", icon: "🎉" },
];

function getCategoryColor(category: string) {
  switch (category) {
    case "wit":
      return "bg-amber-500/10 text-amber-300 border-amber-500/30";
    case "weather":
      return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
    case "dinner":
      return "bg-rose-500/10 text-rose-300 border-rose-500/30";
    case "fitness":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    case "fomo":
      return "bg-red-500/10 text-red-300 border-red-500/30";
    case "weekend":
      return "bg-purple-500/10 text-purple-300 border-purple-500/30";
    default:
      return "bg-slate-800 text-slate-300 border-slate-700";
  }
}

const PRESET_TEMPLATES: MarketingTemplate[] = [
  // ── 1. Zomato Wit & Relatable Banter ──
  {
    id: "wit-1",
    name: "Uska Message Nahi Hai 😅",
    icon: "📱",
    category: "wit",
    tag: "Relatable Wit",
    title: "Notification sun ke laga uska tha? 😅",
    body: "Nahi, fresh Himalayan Trout ka hai! She might ghost you, but our delivery rider never will. Hot crispy trout tonight?",
    url: "/shop/gutted-trout",
  },
  {
    id: "wit-2",
    name: "Commitment Issues? 💍",
    icon: "💍",
    category: "wit",
    tag: "Witty Hook",
    title: "Commitment issues? No pressure. 🐟",
    body: "Don't commit to forever, just commit to dinner tonight. Cleaned & gutted Rainbow Trout delivered cold on ice in 90 mins.",
    url: "/shop",
  },
  {
    id: "wit-3",
    name: "Khali Fridge Syndrome 👀",
    icon: "👀",
    category: "wit",
    tag: "Kitchen Banter",
    title: "Khali fridge ko baar baar dekhna band karo 👀",
    body: "Opening the door for the 5th time won't cook dinner. Treat yourself to fresh trout—pan-sear in 6 mins, dinner sorted!",
    url: "/shop/gutted-trout",
  },
  {
    id: "wit-4",
    name: "Salary Day Royalty 👑",
    icon: "💸",
    category: "wit",
    tag: "Payday Craving",
    title: "Salary aa gayi? Time to eat like royalty 👑",
    body: "Skip the regular dal-chawal today. You worked hard all month—celebrate with fresh pan-fried Rainbow Trout tonight!",
    url: "/shop",
  },

  // ── 2. Weather & Srinagar Vibes ──
  {
    id: "weather-1",
    name: "Mausam Toh Dekho 🌧️",
    icon: "🌧️",
    category: "weather",
    tag: "Srinagar Weather",
    title: "Srinagar ka mausam dekha? 🌧️🐟",
    body: "Chilly breeze + hot pan-fried crispy trout with garlic butter. It doesn't get more heavenly than this. Order now!",
    url: "/shop/gutted-trout",
  },
  {
    id: "weather-2",
    name: "Jumma Mubarak Feast 🤲",
    icon: "🤲",
    category: "weather",
    tag: "Friday Special",
    title: "Jumma Mubarak! Royal Lunch Awaits 🤲",
    body: "Upgrade today's family feast with fresh cold-water Rainbow Trout from Malabagh. Fresh morning harvest packing now!",
    url: "/shop/whole-trout",
  },
  {
    id: "weather-3",
    name: "Tired of Mutton? 🐑",
    icon: "🐑",
    category: "weather",
    tag: "Palate Cleanser",
    title: "Wazwan & mutton overload? 🤤",
    body: "Give your stomach a delicious light break! Clean, crisp Himalayan trout packed with pure flavour and zero heaviness.",
    url: "/shop/gutted-trout",
  },
  {
    id: "weather-4",
    name: "Sham Ki Sardi Comfort ❄️",
    icon: "❄️",
    category: "weather",
    tag: "Winter Comfort",
    title: "Sham ki sardi + Garama-garam Trout ❄️🔥",
    body: "When temperatures drop, nothing warms the soul like spicy pan-seared trout. Packed on ice, delivered to your door.",
    url: "/shop",
  },

  // ── 3. Lunch & Dinner Rush ──
  {
    id: "dinner-1",
    name: "Office Hunger Pangs 🤤",
    icon: "🤤",
    category: "dinner",
    tag: "Lunch Reminder",
    title: "Office mein baithe baithe bhook lag gayi? 🤤",
    body: "Plan tonight's dinner now so you don't scramble at 9 PM. Farm-fresh trout waiting at your doorstep when you reach home!",
    url: "/shop",
  },
  {
    id: "dinner-2",
    name: "6-Minute Quick Dinner ⏱️",
    icon: "⏱️",
    category: "dinner",
    tag: "Quick Cook",
    title: "Too tired to cook after a long day? 😴",
    body: "Cleaned, gutted, zero fishy smell. Pan-sear for 3 minutes each side and your 5-star restaurant dinner is ready!",
    url: "/shop/gutted-trout",
  },
  {
    id: "dinner-3",
    name: "Aaj Dinner Mein Kya Hai? 🍲",
    icon: "🍲",
    category: "dinner",
    tag: "Dinner Solved",
    title: "Aaj dinner mein kya banega? Problem solved! 💡",
    body: "Crispy skin rainbow trout with steamed basmati rice. Freshly harvested from Malabagh springs today.",
    url: "/shop",
  },
  {
    id: "dinner-4",
    name: "Late Evening Delivery 🌙",
    icon: "🌙",
    category: "dinner",
    tag: "Last Dispatch",
    title: "Evening craving rescue squad! 🌙🐟",
    body: "Last delivery slot closing soon for Srinagar! Lock in your fresh catch before our chilled dispatch vans roll out.",
    url: "/shop",
  },

  // ── 4. Gym & High-Protein Fitness ──
  {
    id: "fitness-1",
    name: "Ditch Dry Chicken Breast 🐔",
    icon: "🐔",
    category: "fitness",
    tag: "Gym & Macros",
    title: "Still chewing dry chicken breast? 😩",
    body: "Switch to 32g clean protein + Omega-3s. Tender, juicy Rainbow Trout with zero carbs and natural healthy fats. Hit your macros!",
    url: "/shop/gutted-trout",
  },
  {
    id: "fitness-2",
    name: "Post-Workout Muscle Fuel 💪",
    icon: "💪",
    category: "fitness",
    tag: "Post-Workout",
    title: "Your muscles called: they want real nutrition 💪",
    body: "Glacier-water Rainbow Trout packed with pure anti-inflammatory Omega-3 fatty acids. Clean fuel for lean gains.",
    url: "/shop",
  },
  {
    id: "fitness-3",
    name: "Brain & Heart Superfood 🧠",
    icon: "🧠",
    category: "fitness",
    tag: "Clean Nutrition",
    title: "Eat smarter: Himalayan Trout nutrition 🐟⚡",
    body: "Zero antibiotics, zero muddy taste. Raised in oxygen-rich mountain water. Pure brain food for you and your family.",
    url: "/shop",
  },
  {
    id: "fitness-4",
    name: "Zero Cheat Meal Guilt 🥗",
    icon: "🥗",
    category: "fitness",
    tag: "Guilt-Free",
    title: "Taste of a cheat meal, macros of a champion 🏆",
    body: "Crispy skin trout that tastes like a luxury restaurant cheat meal, but fits your clean diet perfectly. Order fresh today.",
    url: "/shop/gutted-trout",
  },

  // ── 5. Flash Urgency & Scarcity ──
  {
    id: "fomo-1",
    name: "7 AM Glacier Harvest ❄️",
    icon: "❄️",
    category: "fomo",
    tag: "Hyper-Fresh",
    title: "Swimming in glacier water at 7 AM ❄️",
    body: "On your dining table by 1 PM! You can't get fresher than this anywhere in Srinagar. Morning batch selling fast.",
    url: "/shop",
  },
  {
    id: "fomo-2",
    name: "Stock Running Low 🚨",
    icon: "🚨",
    category: "fomo",
    tag: "Urgency / FOMO",
    title: "Stock running critically low! 🚨",
    body: "Today's fresh harvest is almost sold out. Grab your 1kg cleaned trout box before the live tanks close for the day.",
    url: "/shop/gutted-trout",
  },
  {
    id: "fomo-3",
    name: "Live Tanks Jumbo Restock 🌊",
    icon: "🌊",
    category: "fomo",
    tag: "Jumbo Catch",
    title: "Live Tanks Restocked with Jumbo Trout! 🌊",
    body: "Our high-density RAS tanks just harvested prime 400g-500g beauties. Juicy, thick fillets perfect for pan-frying.",
    url: "/shop/whole-trout",
  },

  // ── 6. Weekend & Gatherings ──
  {
    id: "weekend-1",
    name: "Weekend BBQ Grill Night 🔥",
    icon: "🔥",
    category: "weekend",
    tag: "BBQ Showstopper",
    title: "The boys are coming over? Fire up the grill! 🔥",
    body: "Marinate whole rainbow trout with lemon, garlic & Kashmiri red chili. The ultimate weekend BBQ showstopper.",
    url: "/shop/whole-trout",
  },
  {
    id: "weekend-2",
    name: "Sunday Family Lunch 👨‍👩‍👧‍👦",
    icon: "👨‍👩‍👧‍👦",
    category: "weekend",
    tag: "Family Feast",
    title: "Sunday Family Lunch sorted in style 👨‍👩‍👧‍👦",
    body: "Gather everyone around a sizzling platter of fresh Rainbow Trout. Cleaned, gutted, packed on ice—zero kitchen hassle.",
    url: "/shop",
  },
  {
    id: "weekend-3",
    name: "Surprise Guests at Home? ✨",
    icon: "✨",
    category: "weekend",
    tag: "Guest Hosting",
    title: "Mehmon aa rahe hain? Impress them! 🍽️✨",
    body: "Nothing impresses guests like fresh Himalayan Rainbow Trout. Delivered chilled in sealed ice packs in 90 mins.",
    url: "/shop/whole-trout",
  },
  {
    id: "weekend-4",
    name: "We Miss You! 🥺",
    icon: "🥺",
    category: "weekend",
    tag: "Re-engagement",
    title: "It's been a while since your last fresh catch... 🥺",
    body: "Your tastebuds miss that crisp skin and tender flaky meat. Fresh trout is calling your name today!",
    url: "/shop",
  },
];

export default function AdminNotificationsPage() {
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Form State
  const [title, setTitle] = useState(PRESET_TEMPLATES[0].title);
  const [body, setBody] = useState(PRESET_TEMPLATES[0].body);
  const [url, setUrl] = useState(PRESET_TEMPLATES[0].url);
  const [targetMode, setTargetMode] = useState<"broadcast" | "targeted">("broadcast");
  const [targetPhone, setTargetPhone] = useState("");

  // Preset Template Filter & Selection State
  const [activePresetId, setActivePresetId] = useState<string>(PRESET_TEMPLATES[0].id);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isSending, setIsSending] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<any>(null);

  // Load subscriber stats
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await adminFetch("/api/push/send");
      const data = await res.json();
      if (data.success) {
        setStats(data);
      } else {
        console.warn("Failed to load subscriber stats:", data.error);
      }
    } catch (err: any) {
      console.warn("Error fetching subscriber stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const applyPreset = (preset: MarketingTemplate) => {
    setActivePresetId(preset.id);
    setTitle(preset.title);
    setBody(preset.body);
    setUrl(preset.url);
    toast.success(`Loaded "${preset.name}" into Composer`);
  };

  const filteredTemplates = PRESET_TEMPLATES.filter((preset) => {
    const matchesCategory = selectedCategory === "all" || preset.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      preset.name.toLowerCase().includes(q) ||
      preset.title.toLowerCase().includes(q) ||
      preset.body.toLowerCase().includes(q) ||
      preset.tag.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const handleSendPush = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Please enter a title and message body.");
      return;
    }

    if (targetMode === "targeted" && !targetPhone.trim()) {
      toast.error("Please enter the recipient phone number.");
      return;
    }

    const confirmMsg =
      targetMode === "broadcast"
        ? `Are you sure you want to broadcast this push notification to all ${stats?.totalSubscribers ?? "active"} subscribers?`
        : `Send targeted push notification to ${targetPhone}?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSending(true);
    try {
      const res = await adminFetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: targetMode,
          title,
          body,
          url,
          phone: targetMode === "targeted" ? targetPhone : undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Push notification sent successfully! 🚀");
        setLastBroadcast({
          title,
          body,
          time: new Date().toLocaleTimeString(),
          sent: data.sent,
        });
        fetchStats();
      } else {
        toast.error(data.error || "Failed to send notification.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error while sending push.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendLocalTest = async () => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      toast.error("Notifications not supported in this browser window.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied on this device.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title || "Urban Trout Alert", {
        body: body || "Test push notification preview.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: url || "/" },
        vibrate: [100, 50, 100],
      } as any);

      toast.success("Test notification triggered on your screen!");
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger test.");
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono tracking-widest text-cyan-400 uppercase">
              Web Push Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Space_Grotesk'] mt-1">
            Push Alerts &amp; Broadcast Center
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-['Manrope']">
            Send instant harvest alerts and promotion toasts to customers&apos; phone lock screens &amp; desktops.
          </p>
        </div>

        {/* Stats Chip & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 bg-slate-900/80 border border-cyan-500/30 px-4 py-2.5 rounded-2xl shadow-lg">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-sm">
              🔔
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                Active Subscribers
              </p>
              <p className="text-lg font-black text-white font-['Space_Grotesk'] leading-tight">
                {loadingStats ? "…" : stats?.totalSubscribers ?? 0}{" "}
                <span className="text-xs text-cyan-400 font-normal">Devices</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchStats}
            disabled={loadingStats}
            title="Refresh subscriber count"
            className="w-10 h-10 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${loadingStats ? "animate-spin text-cyan-400" : ""}`}>
              sync
            </span>
          </button>
        </div>
      </div>

      {/* ── Active Subscriber Devices Panel ── */}
      {stats && stats.totalSubscribers > 0 && (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/20 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-['Space_Grotesk']">
                Connected Subscriber Devices ({stats.totalSubscribers})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Ready for Instant Web Push
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {stats.sampleSubscribers?.map((sub, idx) => {
              const deviceLabel = getDeviceLabel(sub.userAgent);
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate font-['Space_Grotesk']">
                      {deviceLabel}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                      {sub.phone ? `Phone: ${sub.phone}` : sub.email ? sub.email : "Customer PWA"}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                    Active ✓
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Zomato-Style Marketing Preset Templates ── */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                Marketing Strategy Center
              </span>
              <span className="text-xs font-mono text-slate-400">
                {filteredTemplates.length} of {PRESET_TEMPLATES.length} Templates
              </span>
            </div>
            <h2 className="text-sm md:text-base font-bold text-white mt-1 font-['Space_Grotesk']">
              Zomato-Style Marketing Alert Templates
            </h2>
            <p className="text-xs text-slate-400">
              Witty hooks, weather cravings, meal rushes &amp; high-protein angles. Click any card to instantly populate the composer.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates (e.g. gym, rain, fridge)..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-7 py-2 text-xs text-white outline-none placeholder:text-slate-500 font-['Manrope']"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const count =
              cat.id === "all"
                ? PRESET_TEMPLATES.length
                : PRESET_TEMPLATES.filter((t) => t.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                    : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isSelected ? "bg-slate-950 text-cyan-300" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Templates Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[480px] overflow-y-auto pr-1">
          {filteredTemplates.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`p-3.5 rounded-2xl text-left transition-all group cursor-pointer flex flex-col justify-between relative overflow-hidden border ${
                  isActive
                    ? "bg-slate-900/90 border-cyan-400 ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/10"
                    : "bg-slate-950/80 border-slate-800/80 hover:border-cyan-500/40 hover:bg-slate-900/70"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${getCategoryColor(
                        preset.category
                      )}`}
                    >
                      {preset.tag}
                    </span>
                    <span className="text-lg">{preset.icon}</span>
                  </div>

                  <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors font-['Space_Grotesk'] line-clamp-1">
                    {preset.name}
                  </p>

                  <p className="text-[11px] font-semibold text-cyan-300/90 mt-1 line-clamp-1">
                    {preset.title}
                  </p>

                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {preset.body}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-mono truncate max-w-[120px]">
                    {preset.url}
                  </span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-300"
                    }`}
                  >
                    {isActive ? "Loaded ✓" : "Use ↵"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Composer & Live Preview Grid ── */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Message Composer (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white font-['Space_Grotesk']">
            Notification Composer
          </h2>

          {/* Target Audience Selector */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Audience
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetMode("broadcast")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  targetMode === "broadcast"
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                    : "bg-slate-900 text-slate-300 border border-slate-800 hover:text-white"
                }`}
              >
                Broadcast to All ({stats?.totalSubscribers ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setTargetMode("targeted")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  targetMode === "targeted"
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                    : "bg-slate-900 text-slate-300 border border-slate-800 hover:text-white"
                }`}
              >
                Target Specific Customer
              </button>
            </div>
          </div>

          {targetMode === "targeted" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                Customer Phone Number (10 digits)
              </label>
              <input
                type="tel"
                maxLength={10}
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Notification Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning Harvest Alert 🐟"
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>

          {/* Message Body */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Message Text ({body.length} characters)
            </label>
            <textarea
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What should customers see on their lock screen?"
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Destination URL */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              On-Click Destination URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/shop or /account"
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSendPush}
              disabled={isSending}
              className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/25 active:scale-[0.99]"
            >
              {isSending ? "Sending Alert…" : targetMode === "broadcast" ? "Broadcast to All Subscribers 🚀" : "Send Customer Alert 📲"}
            </button>

            <button
              type="button"
              onClick={handleSendLocalTest}
              className="py-3 px-4 rounded-xl border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Preview on My Screen 👁️
            </button>
          </div>
        </div>

        {/* Right: Live Device Mockup (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-['Space_Grotesk']">
              Live Lock Screen Preview
            </h3>

            {/* Simulated Phone Toast */}
            <div className="p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/40 shadow-2xl space-y-2 backdrop-blur-xl">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-3.5 h-3.5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[9px] font-bold">
                    UT
                  </span>
                  <span className="text-slate-300 font-semibold">URBAN TROUT</span>
                </div>
                <span>now</span>
              </div>

              <div className="flex items-start gap-3 pt-1">
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-cyan-500/40 p-1 flex items-center justify-center shrink-0">
                  <img src="/icon-192.png" alt="Urban Trout" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white tracking-wide leading-snug">
                    {title || "Notification Title"}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-snug mt-0.5 line-clamp-3">
                    {body || "Message preview will appear here as you type in the composer."}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-[10px] text-slate-400">
                <span>Tapping opens: <strong className="text-cyan-400 font-mono">{url || "/shop"}</strong></span>
                <span className="text-cyan-400">Tap to view →</span>
              </div>
            </div>

            {/* Last Broadcast Report */}
            {lastBroadcast && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-slate-200 space-y-1">
                <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span> Last Broadcast Sent at {lastBroadcast.time}
                </p>
                <p className="text-[11px] text-slate-300">
                  Delivered to <strong>{lastBroadcast.sent}</strong> device(s).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
