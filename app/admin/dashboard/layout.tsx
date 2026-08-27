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
  settings?: boolean;
  can_delete?: boolean;
}

const ALL_NAV_ITEMS = [
  { href: "/admin/dashboard/billing", icon: "point_of_sale", label: "POS Billing / Invoices", permKey: "billing", badge: "Live" },
  { href: "/admin/dashboard", icon: "dashboard", label: "Dashboard", permKey: null },
  { href: "/admin/dashboard/orders", icon: "receipt_long", label: "Orders", permKey: "orders" },
  { href: "/admin/dashboard/leads", icon: "phone_callback", label: "Leads & Abandoned", permKey: "leads" },
  { href: "/admin/dashboard/inventory", icon: "inventory_2", label: "Inventory", permKey: "inventory" },
  { href: "/admin/dashboard/customers", icon: "people", label: "Customers", permKey: "customers" },
  { href: "/admin/dashboard/analytics", icon: "analytics", label: "Analytics", permKey: "analytics" },
  { href: "/admin/dashboard/farm", icon: "psychiatry", label: "Farm Mgmt", permKey: "farm" },
  { href: "/admin/dashboard/settings", icon: "settings", label: "Settings", permKey: "settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
    const authStatus = sessionStorage.getItem("ut_admin_auth");
    const storedEmail = sessionStorage.getItem("ut_admin_email") || "sofisuhail007@gmail.com";
    const storedRole = sessionStorage.getItem("ut_admin_role") || "sales_staff";
    const storedPerms = sessionStorage.getItem("ut_admin_permissions");

    setAdminEmail(storedEmail);
    setAdminRole(storedRole);

    if (storedPerms) {
      try {
        setPermissions(JSON.parse(storedPerms));
      } catch {}
    }

    if (!authStatus) {
      // Check if Supabase has active session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          const userEmail = session.user.email.toLowerCase();
          sessionStorage.setItem("ut_admin_auth", "1");
          sessionStorage.setItem("ut_admin_email", userEmail);
          setAdminEmail(userEmail);
          return;
        }
        router.replace("/admin");
      });
    }
  }, [router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    sessionStorage.removeItem("ut_admin_auth");
    sessionStorage.removeItem("ut_admin_email");
    sessionStorage.removeItem("ut_admin_role");
    sessionStorage.removeItem("ut_admin_permissions");
    router.push("/admin");
  };

  if (!mounted) return null;

  // Filter Nav Items according to staff permissions
  const filteredNav = ALL_NAV_ITEMS.filter((item) => {
    if (!item.permKey) return true;
    return permissions[item.permKey as keyof StaffPermissions] !== false;
  });

  // Check if current route is allowed
  const currentNav = ALL_NAV_ITEMS.find((item) => pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href)));
  const isRouteBlocked = currentNav?.permKey && permissions[currentNav.permKey as keyof StaffPermissions] === false;

  return (
    <div className="flex h-screen bg-[#020d12] text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-slate-800 bg-slate-950/90 transition-all duration-300 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3.5 py-4 border-b border-slate-800 overflow-hidden">
          {!collapsed ? (
            <img
              src="/headerfooterlogo.png"
              alt="Urban Trout"
              className="h-7 w-auto object-contain"
            />
          ) : (
            <img
              src="/sitelogo.png"
              alt="Urban Trout"
              className="w-8 h-8 rounded-lg object-contain"
            />
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto text-slate-600 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">
              {collapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-1 px-2.5 overflow-y-auto">
          {filteredNav.map((item) => {
            const active =
              item.href === "/admin/dashboard"
                ? pathname === "/admin/dashboard"
                : pathname.startsWith(item.href);

            const isBilling = item.href === "/admin/dashboard/billing";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                  active
                    ? isBilling
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                      : "bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/25"
                    : isBilling
                    ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-bold"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[19px] flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span style={{ fontFamily: '"Manrope", sans-serif' }}>{item.label}</span>}
                </div>
                {!collapsed && item.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Admin Profile & Logout */}
        <div className="px-2.5 pb-4 border-t border-slate-800 pt-3 space-y-2">
          {!collapsed && adminEmail && (
            <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 font-mono">
                  {adminRole.replace("_", " ")}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <p className="text-xs text-slate-300 font-medium truncate" style={{ fontFamily: '"Manrope", sans-serif' }}>
                {adminEmail}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all text-xs font-semibold cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">logout</span>
            {!collapsed && <span style={{ fontFamily: '"Manrope", sans-serif' }}>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {isRouteBlocked ? (
          <div className="flex items-center justify-center min-h-[80vh] p-4 text-center">
            <div className="max-w-md bg-slate-900/80 border border-red-500/30 rounded-3xl p-8 space-y-4">
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
