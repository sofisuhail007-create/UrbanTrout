"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const NAV = [
  { href: "/admin/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/dashboard/orders", icon: "receipt_long", label: "Orders" },
  { href: "/admin/dashboard/leads", icon: "phone_callback", label: "Leads & Abandoned" },
  { href: "/admin/dashboard/inventory", icon: "inventory_2", label: "Inventory" },
  { href: "/admin/dashboard/customers", icon: "people", label: "Customers" },
  { href: "/admin/dashboard/analytics", icon: "analytics", label: "Analytics" },
  { href: "/admin/dashboard/farm", icon: "psychiatry", label: "Farm Mgmt" },
  { href: "/admin/dashboard/settings", icon: "settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const authStatus = sessionStorage.getItem("ut_admin_auth");
    const storedEmail = sessionStorage.getItem("ut_admin_email") || "sofisuhail007@gmail.com";
    setAdminEmail(storedEmail);

    if (!authStatus) {
      // Check if Supabase has active session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          const userEmail = session.user.email.toLowerCase();
          const rawWhitelist = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "sofisuhail007@gmail.com,admin@urbantrout.in";
          const allowed = rawWhitelist.split(",").map((e) => e.trim().toLowerCase());
          if (allowed.includes(userEmail) || userEmail === "sofisuhail007@gmail.com") {
            sessionStorage.setItem("ut_admin_auth", "1");
            sessionStorage.setItem("ut_admin_email", userEmail);
            setAdminEmail(userEmail);
            return;
          }
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
    router.push("/admin");
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-[#020d12] text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-slate-800 bg-slate-950/80 transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-slate-800 overflow-hidden">
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
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {NAV.map((item) => {
            const active =
              item.href === "/admin/dashboard"
                ? pathname === "/admin/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                  active
                    ? "bg-cyan-500/15 text-cyan-400 font-semibold"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-[18px] flex-shrink-0">{item.icon}</span>
                {!collapsed && <span style={{ fontFamily: '"Manrope", sans-serif' }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Admin Profile & Logout */}
        <div className="px-2 pb-4 border-t border-slate-800 pt-3 space-y-2">
          {!collapsed && adminEmail && (
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-2 overflow-hidden">
              <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-[11px] text-slate-400 truncate" style={{ fontFamily: '"Manrope", sans-serif' }}>
                {adminEmail}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">logout</span>
            {!collapsed && <span style={{ fontFamily: '"Manrope", sans-serif' }}>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
