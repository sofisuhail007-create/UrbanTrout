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
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "COUNTER & POS",
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
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { href: "/admin/dashboard", icon: "dashboard", label: "Dashboard", permKey: null },
      { href: "/admin/dashboard/orders", icon: "receipt_long", label: "Orders", permKey: "orders" },
      { href: "/admin/dashboard/visits", icon: "calendar_month", label: "Farm Visits", permKey: "farm" },
      { href: "/admin/dashboard/leads", icon: "phone_callback", label: "Leads & Abandoned", permKey: "leads" },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { href: "/admin/dashboard/inventory", icon: "inventory_2", label: "Inventory", permKey: "inventory" },
      { href: "/admin/dashboard/customers", icon: "people", label: "Customers", permKey: "customers" },
      { href: "/admin/dashboard/analytics", icon: "analytics", label: "Analytics", permKey: "analytics" },
      { href: "/admin/dashboard/farm", icon: "psychiatry", label: "Farm Mgmt", permKey: "farm" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/admin/dashboard/delivery", icon: "radar", label: "Delivery Radius", permKey: "settings", badge: "Map", badgeType: "map" },
      { href: "/admin/dashboard/settings", icon: "settings", label: "Settings", permKey: "settings" },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminRole, setAdminRole] = useState<string>("staff");
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
    setMounted(true);
    // 1. Read persistent session from localStorage (with sessionStorage fallback)
    const authStatus = localStorage.getItem("ut_admin_auth") || sessionStorage.getItem("ut_admin_auth");
    const storedEmail = localStorage.getItem("ut_admin_email") || sessionStorage.getItem("ut_admin_email") || "sofisuhail007@gmail.com";
    const storedRole = localStorage.getItem("ut_admin_role") || sessionStorage.getItem("ut_admin_role") || "sales_staff";
    const storedPerms = localStorage.getItem("ut_admin_permissions") || sessionStorage.getItem("ut_admin_permissions");

    setAdminEmail(storedEmail);
    setAdminRole(storedRole);

    if (storedPerms) {
      try {
        setPermissions(JSON.parse(storedPerms));
      } catch {}
    }

    // 2. Proactive Supabase auth listener to keep session permanently active & refreshed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase();
        localStorage.setItem("ut_admin_auth", "1");
        localStorage.setItem("ut_admin_email", userEmail);
        setAdminEmail(userEmail);
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

    // 3. If neither localStorage nor Supabase has session, redirect to login
    if (!authStatus) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          const userEmail = session.user.email.toLowerCase();
          localStorage.setItem("ut_admin_auth", "1");
          localStorage.setItem("ut_admin_email", userEmail);
          setAdminEmail(userEmail);
          return;
        }
        router.replace("/admin");
      }).catch(() => {
        router.replace("/admin");
      });
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

  if (!mounted) return null;

  // Filter Nav Groups according to staff permissions
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.permKey) return true;
      return permissions[item.permKey as keyof StaffPermissions] !== false;
    }),
  })).filter((group) => group.items.length > 0);

  // Check if current route is allowed
  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const currentNav = allItems.find(
    (item) => pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href + "/"))
  );
  const isRouteBlocked = currentNav?.permKey && permissions[currentNav.permKey as keyof StaffPermissions] === false;

  const isItemActive = (href: string) => {
    if (href === "/admin/dashboard") {
      return pathname === "/admin/dashboard";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#020d12] text-slate-200 overflow-hidden font-['Manrope']">
      {/* ─── MOBILE TOP BAR (Visible on screens < md) ─── */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800/80 z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/sitelogo.png" alt="Urban Trout" className="w-7 h-7 rounded-lg object-contain border border-cyan-500/30" />
          <span className="text-sm font-black tracking-tight text-white font-['Space_Grotesk']">
            URBAN <span className="text-cyan-400">TROUT</span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            {adminRole.replace("_", " ")}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-300 active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl">{mobileMenuOpen ? "close" : "menu"}</span>
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
        className={`fixed md:relative top-0 bottom-0 left-0 z-50 md:z-20 flex flex-col border-r border-slate-800/80 bg-[#030d14] flex-shrink-0 transition-all duration-200 ${
          mobileMenuOpen ? "translate-x-0 w-72 shadow-2xl" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "md:w-16" : "md:w-64"}`}
      >
        {/* Floating Expand Arrow on the right border when collapsed (Desktop) */}
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="hidden md:flex absolute -right-3.5 top-6 z-50 w-7 h-7 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 items-center justify-center shadow-lg shadow-cyan-500/40 hover:scale-110 transition-all cursor-pointer border-2 border-[#020d12]"
            title="Expand sidebar (Show menu options)"
          >
            <span className="material-symbols-outlined text-sm font-black">chevron_right</span>
          </button>
        )}

        {/* Logo / Header Area */}
        {!collapsed ? (
          <div className="flex items-center justify-between px-3.5 py-3.5 border-b border-slate-800/80 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/sitelogo.png"
                alt="Urban Trout"
                className="w-8 h-8 rounded-xl object-contain border border-cyan-500/30 bg-slate-900 shadow-sm shadow-cyan-500/20 flex-shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black tracking-tight text-white leading-tight font-['Space_Grotesk'] truncate">
                  URBAN <span className="text-cyan-400">TROUT</span>
                </span>
                <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase font-mono mt-0.5">
                  Aquaculture Admin
                </span>
              </div>
            </div>

            {/* Desktop Collapse Toggle */}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="hidden md:flex ml-2 w-7 h-7 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer flex-shrink-0"
              title="Collapse sidebar"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden ml-auto text-slate-400 hover:text-white p-1"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-3.5 border-b border-slate-800/80 gap-2 flex-shrink-0">
            {/* Clickable Logo that also expands */}
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="group flex items-center justify-center cursor-pointer"
              title="Click to expand sidebar"
            >
              <img
                src="/sitelogo.png"
                alt="Urban Trout"
                className="w-8 h-8 rounded-xl object-contain border border-cyan-500/30 bg-slate-900 shadow-sm shadow-cyan-500/20 group-hover:border-cyan-400 transition-all"
              />
            </button>

            {/* Centered Expand Button inside collapsed header */}
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="w-7 h-7 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm shadow-cyan-500/10"
              title="Expand sidebar (Show menu options)"
            >
              <span className="material-symbols-outlined text-sm font-bold">chevron_right</span>
            </button>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2.5 overflow-y-auto space-y-4">
          {visibleGroups.map((group, groupIdx) => (
            <div key={group.title} className="space-y-1">
              {/* Group Title (Hidden when collapsed) */}
              {(!collapsed || mobileMenuOpen) ? (
                <div className="px-2.5 pt-1 pb-1">
                  <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase font-mono">
                    {group.title}
                  </span>
                </div>
              ) : groupIdx > 0 ? (
                <div className="my-2 mx-2 border-t border-slate-800/80" />
              ) : null}

              {/* Group Items */}
              {group.items.map((item) => {
                const active = isItemActive(item.href);
                const isBilling = item.href === "/admin/dashboard/billing";
                const isVending = item.href === "/admin/dashboard/vending-log";

                // Active & Inactive Styling
                let linkStyle = "";
                if (active) {
                  if (item.activeTheme === "emerald") {
                    linkStyle =
                      "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 font-bold shadow-sm shadow-emerald-500/10";
                  } else {
                    linkStyle =
                      "bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 font-bold shadow-sm shadow-cyan-500/10";
                  }
                } else {
                  if (isBilling) {
                    linkStyle =
                      "text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/25 border border-transparent font-medium";
                  } else if (isVending) {
                    linkStyle =
                      "text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/25 border border-transparent font-medium";
                  } else {
                    linkStyle =
                      "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 hover:border-slate-700/60 border border-transparent font-medium";
                  }
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`relative flex items-center ${
                      collapsed && !mobileMenuOpen
                        ? "justify-center h-10 w-10 mx-auto px-0"
                        : "justify-between px-3 py-2.5"
                    } rounded-xl transition-all text-xs ${linkStyle}`}
                  >
                    {/* Active Accent Left Indicator */}
                    {active && !collapsed && (
                      <span
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full ${
                          item.activeTheme === "emerald" ? "bg-emerald-400" : "bg-cyan-400"
                        }`}
                      />
                    )}

                    {/* Icon + Label */}
                    <div className={`flex items-center ${collapsed && !mobileMenuOpen ? "justify-center" : "gap-3"} min-w-0`}>
                      <div className="relative flex items-center justify-center">
                        <span
                          className={`material-symbols-outlined text-[19px] flex-shrink-0 ${
                            active
                              ? item.activeTheme === "emerald"
                                ? "text-emerald-400"
                                : "text-cyan-400"
                              : ""
                          }`}
                        >
                          {item.icon}
                        </span>

                        {/* Collapsed Badge Indicator Dot */}
                        {collapsed && !mobileMenuOpen && item.badge && (
                          <span
                            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-slate-950 ${
                              item.badgeType === "live"
                                ? "bg-emerald-400 animate-pulse"
                                : item.badgeType === "new"
                                ? "bg-cyan-400"
                                : "bg-slate-400"
                            }`}
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
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            LIVE
                          </span>
                        ) : item.badgeType === "new" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/20">
                            NEW
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
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
        <div className="px-2.5 pb-3 border-t border-slate-800/80 pt-3 space-y-2 flex-shrink-0">
          {(!collapsed || mobileMenuOpen) && adminEmail && (
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-400 font-mono">
                    {adminRole.replace("_", " ")}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-slate-400">v2.4</span>
              </div>
              <p className="text-xs text-slate-200 font-medium truncate" title={adminEmail}>
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
                ? "justify-center h-10 w-10 mx-auto px-0"
                : "gap-2.5 px-3 py-2 w-full"
            } rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25 border border-transparent transition-all text-xs font-semibold cursor-pointer`}
          >
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">logout</span>
            {(!collapsed || mobileMenuOpen) && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA (Full Mobile Responsive) ─── */}
      <main className="flex-1 min-w-0 overflow-y-auto relative">
        {isRouteBlocked ? (
          <div className="flex items-center justify-center min-h-[80vh] p-4 text-center">
            <div className="max-w-md bg-slate-900/80 border border-red-500/30 rounded-3xl p-8 space-y-4 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">lock</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Permission Restricted
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
                  Your account does not have access to this section. Please contact your administrator (<code className="text-cyan-400">sofisuhail007@gmail.com</code>) to request permission.
                </p>
              </div>
              <Link
                href="/admin/dashboard/billing"
                className="inline-block py-2.5 px-4 bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider"
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
