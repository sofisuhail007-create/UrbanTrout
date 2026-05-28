"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const NAV = [
  { href: "/admin/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/dashboard/orders", icon: "receipt_long", label: "Orders" },
  { href: "/admin/dashboard/inventory", icon: "inventory_2", label: "Inventory" },
  { href: "/admin/dashboard/customers", icon: "people", label: "Customers" },
  { href: "/admin/dashboard/analytics", icon: "analytics", label: "Analytics" },
  { href: "/admin/dashboard/farm", icon: "psychiatry", label: "Farm Mgmt" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!sessionStorage.getItem("ut_admin_auth")) {
      router.replace("/admin");
    }
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("ut_admin_auth");
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
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-cyan-400 text-base">water</span>
          </div>
          {!collapsed && (
            <span className="font-bold text-cyan-400 text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Urban Trout
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto text-slate-600 hover:text-slate-300 transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              {collapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-1 px-2">
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

        {/* Logout */}
        <div className="px-2 pb-4 border-t border-slate-800 pt-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm"
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
