"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/our-farm", label: "Our Farm" },
  { href: "/traceability", label: "Traceability" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { openCart, itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header
        className="fixed top-4 left-1/2 -translate-x-1/2 w-[94%] max-w-7xl z-50"
        style={{
          borderRadius: "16px",
          border: "1px solid rgba(114,221,253,0.1)",
          background: "rgba(3,16,24,0.75)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          boxShadow: "0 0 40px rgba(114,221,253,0.08), 0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span
              className="text-xl font-black tracking-tighter"
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                color: "#72ddfd",
                textShadow: "0 0 20px rgba(114,221,253,0.4)",
              }}
            >
              Urban Trout
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2 text-sm font-medium transition-all duration-300"
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    color: isActive ? "#72ddfd" : "#9fadb8",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {isActive && (
                    <span
                      className="absolute inset-0 rounded-lg"
                      style={{ background: "rgba(114,221,253,0.08)" }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full"
                      style={{ background: "#72ddfd", boxShadow: "0 0 8px #72ddfd" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <button
              onClick={openCart}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300"
              style={{ color: "#72ddfd" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(114,221,253,0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
              aria-label="Open cart"
            >
              <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
              {itemCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                  style={{
                    background: "#3aadcc",
                    color: "#002730",
                    fontFamily: '"Inter", sans-serif',
                  }}
                >
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </button>

            {/* Mobile menu */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300"
              style={{ color: "#9fadb8" }}
              aria-label="Menu"
            >
              <span className="material-symbols-outlined text-[20px]">
                {mobileOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div
            className="md:hidden border-t px-4 py-4 flex flex-col gap-1"
            style={{ borderColor: "rgba(114,221,253,0.08)" }}
          >
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium transition-all"
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    color: isActive ? "#72ddfd" : "#9fadb8",
                    background: isActive ? "rgba(114,221,253,0.08)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>
    </>
  );
}
