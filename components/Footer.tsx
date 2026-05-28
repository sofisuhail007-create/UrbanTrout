"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <footer className="w-full py-16 border-t border-white/5 bg-slate-950 mt-20">
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        <div>
          <div className="text-lg font-bold text-cyan-400 mb-4 font-headline">
            Urban Trout
          </div>
          <p className="text-slate-500 text-sm font-body leading-relaxed max-w-xs">
            Precision Aquaculture Systems. Innovating the heritage of
            Srinagar&apos;s streams for a sustainable future.
          </p>
        </div>

        <div>
          <h5 className="text-on-surface font-label font-bold text-xs uppercase tracking-[0.2em] mb-6">
            Explore
          </h5>
          <ul className="space-y-3 text-sm font-body text-slate-500">
            <li>
              <Link
                href="/shop"
                className="hover:text-cyan-300 transition-colors duration-200"
              >
                Shop Fresh Catch
              </Link>
            </li>
            <li>
              <Link
                href="/our-farm"
                className="hover:text-cyan-300 transition-colors duration-200"
              >
                Our Farm
              </Link>
            </li>
            <li>
              <Link
                href="/our-farm#traceability-reports"
                className="hover:text-cyan-300 transition-colors duration-200"
              >
                Traceability & Lab Reports
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h5 className="text-on-surface font-label font-bold text-xs uppercase tracking-[0.2em] mb-6">
            Contact
          </h5>
          <div className="space-y-3 text-sm font-body text-slate-500">
            <p>Malabagh Naseem Bagh</p>
            <p>Srinagar — 190006</p>
            <p className="text-xs text-slate-500">Near R P School (Girls Wing)</p>
            <p className="text-cyan-400 font-medium">+91 70066 04148</p>
          </div>
          <div className="flex gap-3 mt-6">
            <a
              href="#"
              className="w-9 h-9 rounded-md border border-outline-variant/30 flex items-center justify-center hover:border-primary text-slate-400 hover:text-primary transition-all"
              aria-label="Share"
            >
              <span className="material-symbols-outlined text-base">share</span>
            </a>
            <a
              href="#"
              className="w-9 h-9 rounded-md border border-outline-variant/30 flex items-center justify-center hover:border-primary text-slate-400 hover:text-primary transition-all"
              aria-label="Email"
            >
              <span className="material-symbols-outlined text-base">
                alternate_email
              </span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <span className="text-slate-600 font-label text-xs uppercase tracking-widest">
          © 2026 Urban Trout. Srinagar, J&K. All rights reserved.
        </span>
        <div className="flex gap-6 font-label text-xs uppercase tracking-widest">
          <a
            href="#"
            className="text-slate-600 hover:text-cyan-300 underline-offset-4 hover:underline transition-all"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="text-slate-600 hover:text-cyan-300 underline-offset-4 hover:underline transition-all"
          >
            Terms
          </a>
          <Link
            href="/our-farm#traceability-reports"
            className="text-slate-600 hover:text-cyan-300 underline-offset-4 hover:underline transition-all"
          >
            Traceability
          </Link>
        </div>
      </div>
    </footer>
  );
}
