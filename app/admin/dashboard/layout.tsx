"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface StaffPermissions {
  billing?: boolean;
  orders?: boolean;
  leads?: boolean;
  inventory?: boolean;
  customers?: boolean;
  analytics?: boolean;
  farm?: boolean;
  visits?: boolean;
  settings?: boolean;
  can_delete?: boolean;
}

interface NavItem {
  href: string;
  icon: string;
  label: string;
  permKey: string | null;
  badge?: string;
  badgeType?: "live" | "new" | "map";
  activeTheme?: "emerald" | "cyan";
  ownerOnly?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Counter & POS",
    items: [
      {
        href: "/admin/dashboard/billing",
        icon: "point_of_sale",
        label: "POS Billing / Invoices",
        permKey: "billing",
        badge: "Live",
        badgeType: "live",
        activeTheme: "emerald",
      },
      {
        href: "/admin/dashboard/vending-log",
        icon: "table_chart",
        label: "Vending Center Log",
        permKey: "billing",
        badge: "New",
        badgeType: "new",
        activeTheme: "cyan",
      },
      {
        href: "/admin/dashboard/delivery-calculator",
        icon: "calculate",
        label: "Delivery Profit Calc",
        permKey: "billing",
        badge: "PRO",
        badgeType: "live",
        activeTheme: "emerald",
        ownerOnly: true,
      },
      {
        href: "/admin/dashboard/billing?tab=customer_balances",
        icon: "account_balance_wallet",
        label: "Customer Khata & Balances",
        permKey: "billing",
        activeTheme: "emerald",
      },
      {
        href: "/admin/dashboard/vending-log?audit=true",
        icon: "history_edu",
        label: "Staff Audit Trail",
        permKey: "settings",
        badge: "Audit",
        badgeType: "new",
        activeTheme: "emerald",
      },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/admin/dashboard", icon: "dashboard", label: "Dashboard", permKey: null },
      { href: "/admin/dashboard/orders", icon: "receipt_long", label: "Orders", permKey: "orders" },
      { href: "/admin/dashboard/visits", icon: "calendar_month", label: "Farm Visits", permKey: "farm" },
      { href: "/admin/dashboard/leads", icon: "phone_callback", label: "Leads & Abandoned", permKey: "leads" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/dashboard/inventory", icon: "inventory_2", label: "Inventory", permKey: "inventory" },
      { href: "/admin/dashboard/customers", icon: "people", label: "Customers", permKey: "customers" },
      { href: "/admin/dashboard/analytics", icon: "analytics", label: "Analytics", permKey: "analytics" },
      { href: "/admin/dashboard/farm", icon: "psychiatry", label: "Farm Mgmt", permKey: "farm" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/dashboard/notifications", icon: "notifications_active", label: "Push Alerts", permKey: "settings", badge: "Push", badgeType: "new", activeTheme: "cyan" },
      { href: "/admin/dashboard/delivery", icon: "radar", label: "Delivery Radius", permKey: "settings", badge: "Map", badgeType: "map" },
      { href: "/admin/dashboard/settings", icon: "settings", label: "Settings", permKey: "settings" },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  // Default to collapsed (icon-only mode) so POS billing and dashboard have maximum screen space
  const [collapsed, setCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Restore user-explicit sidebar toggle preference if set
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ut_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  const handleToggleCollapse = (val: boolean) => {
    setCollapsed(val);
    try {
      localStorage.setItem("ut_sidebar_collapsed", String(val));
    } catch {}
  };
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminRole, setAdminRole] = useState<string>("staff");
  const [adminName, setAdminName] = useState<string>("Suhail");
  const [permissions, setPermissions] = useState<StaffPermissions>({
    billing: true,
    orders: true,
    leads: true,
    inventory: true,
    customers: true,
    analytics: true,
    farm: true,
    settings: true,
    can_delete: true,
  });

  useEffect(() => {
    // Force default 100% scale
    try {
      localStorage.removeItem("ut_admin_ui_zoom");
    } catch {}

    // Prevent mouse wheel from accidentally incrementing/decrementing focused number inputs
    // Attaching directly on focus ensures window scrolling is 100% passive & hardware-accelerated
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement && target.type === "number") {
        const onWheel = (we: WheelEvent) => {
          target.blur();
          we.preventDefault();
        };
        target.addEventListener("wheel", onWheel, { passive: false });
        target.addEventListener(
          "blur",
          () => {
            target.removeEventListener("wheel", onWheel);
          },
          { once: true }
        );
      }
    };
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, []);

  // ─── 5-MINUTE INACTIVITY AUTO-HOMEPAGE TO POS BILLING ───
  useEffect(() => {
    const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes of inactivity
    let inactivityTimer: NodeJS.Timeout | null = null;
    let lastActivityTime = Date.now();

    const triggerAutoHomepage = () => {
      // If user is currently on any other dashboard page (vending log, farm, orders, etc.), redirect to POS Billing
      if (pathname !== "/admin/dashboard/billing") {
        router.push("/admin/dashboard/billing");
      }
      // Broadcast event so billing page snaps to counter "pos" tab & closes sub-modals
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ut_reset_to_pos_billing"));
      }
    };

    const resetTimer = () => {
      lastActivityTime = Date.now();
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        triggerAutoHomepage();
      }, INACTIVITY_MS);
    };

    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle activity checks to once every 10 seconds
      if (now - lastActivityTime > 10000) {
        resetTimer();
      }
    };

    const checkInactivityOnFocus = () => {
      // When device screen wakes up or browser tab regains focus, check elapsed idle time
      if (Date.now() - lastActivityTime >= INACTIVITY_MS) {
        triggerAutoHomepage();
      }
    };

    // Use direct user interaction events (click, key, touch) to avoid high-frequency mousemove thread flooding
    const activityEvents = ["mousedown", "keydown", "touchstart", "click"] as const;
    activityEvents.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));
    window.addEventListener("focus", checkInactivityOnFocus);
    document.addEventListener("visibilitychange", checkInactivityOnFocus);

    // Initialize timer
    resetTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      window.removeEventListener("focus", checkInactivityOnFocus);
      document.removeEventListener("visibilitychange", checkInactivityOnFocus);
    };
  }, [pathname, router]);

  const resolveStaffName = (em: string): string => {
    const clean = em.toLowerCase().trim();
    if (clean === "sofisuhail007@gmail.com" || clean === "info.urbantrout@gmail.com") return "Suhail";
    if (clean === "work.suhail007@gmail.com" || clean === "worksuhail007@gmail.com") return "Mohd Amin";
    const stored = localStorage.getItem("ut_admin_name");
    if (stored && stored.trim()) return stored.trim();
    return "Mohd Amin";
  };

  useEffect(() => {
    setMounted(true);
    // 1. Strictly verify cryptographic Supabase Auth session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.email) {
        // Not authenticated — purge any fake/stale tokens and kick to login
        localStorage.removeItem("ut_admin_auth");
        localStorage.removeItem("ut_admin_email");
        localStorage.removeItem("ut_admin_role");
        localStorage.removeItem("ut_admin_permissions");
        sessionStorage.removeItem("ut_admin_auth");
        sessionStorage.removeItem("ut_admin_email");
        router.replace("/admin");
        return;
      }

      const userEmail = session.user.email.toLowerCase().trim();
      const isOwner = userEmail === "sofisuhail007@gmail.com" || userEmail === "info.urbantrout@gmail.com";
      const userRole = isOwner ? "super_admin" : (localStorage.getItem("ut_admin_role") || "sales_staff");

      localStorage.setItem("ut_admin_auth", "1");
      localStorage.setItem("ut_admin_email", userEmail);
      localStorage.setItem("ut_admin_role", userRole);

      setAdminEmail(userEmail);
      setAdminRole(userRole);
      setAdminName(resolveStaffName(userEmail));
    }).catch(() => {
      router.replace("/admin");
    });

    // 2. Proactive Supabase auth listener to keep session permanently active & handle signout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase().trim();
        const isCurrentOwner = userEmail === "sofisuhail007@gmail.com" || userEmail === "info.urbantrout@gmail.com";
        localStorage.setItem("ut_admin_auth", "1");
        localStorage.setItem("ut_admin_email", userEmail);
        if (isCurrentOwner && !localStorage.getItem("ut_admin_role")) {
          localStorage.setItem("ut_admin_role", "super_admin");
          setAdminRole("super_admin");
        }
        setAdminEmail(userEmail);
        setAdminName(resolveStaffName(userEmail));
      } else if (event === "SIGNED_OUT") {
        localStorage.removeItem("ut_admin_auth");
        localStorage.removeItem("ut_admin_email");
        localStorage.removeItem("ut_admin_role");
        localStorage.removeItem("ut_admin_permissions");
        sessionStorage.removeItem("ut_admin_auth");
        sessionStorage.removeItem("ut_admin_email");
        sessionStorage.removeItem("ut_admin_role");
        sessionStorage.removeItem("ut_admin_permissions");
        router.replace("/admin");
      }
    });

    const storedPerms = localStorage.getItem("ut_admin_permissions") || sessionStorage.getItem("ut_admin_permissions");
    if (storedPerms) {
      try {
        setPermissions(JSON.parse(storedPerms));
      } catch {}
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  // Close mobile drawer upon route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    localStorage.removeItem("ut_admin_auth");
    localStorage.removeItem("ut_admin_email");
    localStorage.removeItem("ut_admin_role");
    localStorage.removeItem("ut_admin_permissions");
    sessionStorage.removeItem("ut_admin_auth");
    sessionStorage.removeItem("ut_admin_email");
    sessionStorage.removeItem("ut_admin_role");
    sessionStorage.removeItem("ut_admin_permissions");
    router.push("/admin");
  };

  if (!mounted) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen h-[100dvh] bg-[#090b0e] text-zinc-200">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-3 max-w-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <span className="material-symbols-outlined text-xl animate-spin">sync</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-200 tracking-wider uppercase font-mono">
                Urban Trout Admin
              </p>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Loading workspace…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isOwnerUser = adminEmail === "sofisuhail007@gmail.com" || adminEmail === "info.urbantrout@gmail.com";

  // Filter Nav Groups according to staff permissions & owner-only access
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.ownerOnly && !isOwnerUser) return false;
      if (!item.permKey) return true;
      return permissions[item.permKey as keyof StaffPermissions] !== false;
    }),
  })).filter((group) => group.items.length > 0);

  // Check if current route is allowed
  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const currentNav = allItems.find(
    (item) => pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href + "/"))
  );
  const isRouteBlocked =
    Boolean(currentNav?.ownerOnly && !isOwnerUser) ||
    Boolean(currentNav?.permKey && permissions[currentNav.permKey as keyof StaffPermissions] === false);

  const isItemActive = (href: string) => {
    if (href === "/admin/dashboard") {
      return pathname === "/admin/dashboard";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen h-[100dvh] bg-black text-zinc-200 overflow-hidden font-['Manrope']">
      {/* ─── MOBILE TOP BAR (Visible on screens < md) ─── */}
      <header className="flex md:hidden items-center justify-between px-3.5 py-2.5 bg-black/95 backdrop-blur-md border-b border-[#222222] z-30 flex-shrink-0 sticky top-0">
        <div className="flex items-center gap-2.5">
          <img src="/sitelogo.png" alt="Urban Trout" className="w-6 h-6 rounded-md object-contain border border-[#333333]" />
          <span className="text-sm font-semibold tracking-tight text-white font-['Space_Grotesk']">
            Urban Trout
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-[#111111] text-zinc-400 border border-[#222222] font-mono">
            {adminRole.replace("_", " ")}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-8 h-8 rounded-lg bg-[#111111] border border-[#222222] flex items-center justify-center text-zinc-300 active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">{mobileMenuOpen ? "close" : "menu"}</span>
        </button>
      </header>

      {/* ─── MOBILE DRAWER BACKDROP OVERLAY ─── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ─── SIDEBAR (Desktop Fixed + Mobile Slide-over Drawer) ─── */}
      <aside
        className={`fixed md:relative top-0 bottom-0 left-0 z-50 md:z-20 flex flex-col border-r border-[#222222] bg-black flex-shrink-0 transition-all duration-200 ${
          mobileMenuOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "md:w-16" : "md:w-60"}`}
      >
        {/* Floating Expand Arrow on the right border when collapsed (Desktop) */}
        {collapsed && (
          <button
            type="button"
            onClick={() => handleToggleCollapse(false)}
            className="hidden md:flex absolute -right-3 top-5 z-50 w-6 h-6 rounded-full bg-[#111111] hover:bg-[#222222] text-zinc-200 items-center justify-center shadow-md border border-[#333333] transition-colors cursor-pointer"
            title="Expand sidebar"
          >
            <span className="material-symbols-outlined text-xs">chevron_right</span>
          </button>
        )}

        {/* Logo / Header Area */}
        {!collapsed ? (
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#222222] flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/sitelogo.png"
                alt="Urban Trout"
                className="w-7 h-7 rounded-lg object-contain border border-[#333333] bg-black flex-shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white leading-tight font-['Space_Grotesk'] truncate">
                  Urban Trout
                </span>
                <span className="text-[10px] text-zinc-400 tracking-normal font-mono mt-0.5">
                  Aquaculture Admin
                </span>
              </div>
            </div>

            {/* Desktop Collapse Toggle */}
            <button
              type="button"
              onClick={() => handleToggleCollapse(true)}
              className="hidden md:flex ml-2 w-7 h-7 rounded-lg bg-black hover:bg-[#111111] border border-[#222222] items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
              title="Collapse sidebar"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden ml-auto text-zinc-400 hover:text-zinc-200 p-1"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-3 border-b border-zinc-800/80 gap-2 flex-shrink-0">
            {/* Clickable Logo that also expands */}
            <button
              type="button"
              onClick={() => handleToggleCollapse(false)}
              className="group flex items-center justify-center cursor-pointer"
              title="Expand sidebar"
            >
              <img
                src="/sitelogo.png"
                alt="Urban Trout"
                className="w-7 h-7 rounded-lg object-contain border border-zinc-700/60 bg-zinc-900 group-hover:border-zinc-500 transition-colors"
              />
            </button>

            <button
              type="button"
              onClick={() => handleToggleCollapse(false)}
              className="w-6 h-6 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
              title="Expand sidebar"
            >
              <span className="material-symbols-outlined text-xs">chevron_right</span>
            </button>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 py-2.5 px-2 overflow-y-auto space-y-3.5">
          {visibleGroups.map((group, groupIdx) => (
            <div key={group.title} className="space-y-0.5">
              {/* Group Title */}
              {(!collapsed || mobileMenuOpen) ? (
                <div className="px-2 pt-1 pb-1">
                  <span className="text-[11px] font-medium text-zinc-400 tracking-wide font-mono">
                    {group.title}
                  </span>
                </div>
              ) : groupIdx > 0 ? (
                <div className="my-1.5 mx-2 border-t border-zinc-800/60" />
              ) : null}

              {/* Group Items */}
              {group.items.map((item) => {
                const active = isItemActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`group relative flex items-center ${
                      collapsed && !mobileMenuOpen
                        ? "justify-center h-9 w-9 mx-auto px-0"
                        : "justify-between px-2.5 py-1.5 h-9"
                    } rounded-md transition-colors text-xs ${
                      active
                        ? "bg-[#161616] text-white font-medium border border-[#333333]"
                        : "text-[#888888] hover:text-white hover:bg-[#111111] border border-transparent font-normal"
                    }`}
                  >
                    {/* Active Accent Left Indicator */}
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-white" />
                    )}

                    {/* Icon + Label */}
                    <div className={`flex items-center ${collapsed && !mobileMenuOpen ? "justify-center" : "gap-2.5"} min-w-0`}>
                      <div className="relative flex items-center justify-center">
                        <span
                          className={`material-symbols-outlined text-[18px] flex-shrink-0 ${
                            active
                              ? "text-white"
                              : "text-[#888888] group-hover:text-white"
                          }`}
                        >
                          {item.icon}
                        </span>

                        {/* Collapsed Badge Indicator Dot */}
                        {collapsed && !mobileMenuOpen && item.badge && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-2 ring-black bg-white"
                          />
                        )}
                      </div>

                      {(!collapsed || mobileMenuOpen) && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </div>

                    {/* Expanded Badge */}
                    {(!collapsed || mobileMenuOpen) && item.badge && (
                      <span className="flex-shrink-0 ml-2">
                        {item.badgeType === "live" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#111111] text-emerald-400 border border-[#262626]">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            Live
                          </span>
                        ) : item.badgeType === "new" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#111111] text-zinc-300 border border-[#262626]">
                            New
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#111111] text-zinc-400 border border-[#262626]">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Admin Profile & Logout */}
        <div className="px-2.5 pb-2.5 border-t border-[#222222] pt-2.5 space-y-2 flex-shrink-0">
          {(!collapsed || mobileMenuOpen) && adminEmail && (
            <div className="p-2 rounded-lg bg-black border border-[#222222]">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[9px] uppercase font-mono tracking-wider text-zinc-400">
                    {adminRole.replace("_", " ")}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-zinc-400">v2.4</span>
              </div>
              <p className="text-xs font-medium text-white truncate font-mono" title={adminName}>
                {adminName}
              </p>
              <p className="text-[11px] text-zinc-400 font-mono truncate" title={adminEmail}>
                {adminEmail}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={`flex items-center ${
              collapsed && !mobileMenuOpen
                ? "justify-center h-8 w-8 mx-auto px-0"
                : "gap-2 px-2.5 py-1.5 w-full"
            } rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors text-xs font-medium cursor-pointer`}
          >
            <span className="material-symbols-outlined text-[16px] flex-shrink-0">logout</span>
            {(!collapsed || mobileMenuOpen) && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA (Full Mobile Responsive) ─── */}
      <main className="flex-1 min-w-0 overflow-y-auto relative pb-20 md:pb-6 overscroll-contain bg-black">
        {isRouteBlocked ? (
          <div className="flex items-center justify-center min-h-[80vh] p-4 text-center">
            <div className="max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-xl">lock</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-100 mb-1 font-['Space_Grotesk']">
                  Permission Restricted
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed font-['Manrope']">
                  Your account does not have access to this section. Please contact your administrator (<code className="text-zinc-300">sofisuhail007@gmail.com</code>) to request permission.
                </p>
              </div>
              <Link
                href="/admin/dashboard/billing"
                className="inline-block py-2 px-3.5 bg-zinc-100 hover:bg-white text-zinc-950 font-medium rounded-lg text-xs transition-colors"
              >
                Go to POS Billing
              </Link>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
