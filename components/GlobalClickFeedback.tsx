"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const INTERACTIVE_SELECTOR =
  'button:not(:disabled), a[href], [role="button"]:not([aria-disabled="true"]), input[type="submit"]:not(:disabled), input[type="button"]:not(:disabled), summary';

interface RippleOverlay {
  id: number;
  rectTop: number;
  rectLeft: number;
  rectWidth: number;
  rectHeight: number;
  borderRadius: string;
  clickX: number;
  clickY: number;
  size: number;
  isLightBg: boolean;
}

function isLightBackground(el: HTMLElement): boolean {
  try {
    const bg = window.getComputedStyle(el).backgroundColor;
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return false;
    const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
    if (alpha < 0.25) return false;
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    // Relative perceived luminance (ITU-R BT.601)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.58;
  } catch {
    return false;
  }
}

function GlobalClickFeedbackInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() || "";

  const [ripples, setRipples] = useState<RippleOverlay[]>([]);
  const [navState, setNavState] = useState<"idle" | "loading" | "finishing">("idle");
  const rippleIdRef = useRef(0);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatingElRef = useRef<HTMLElement | null>(null);

  // Finish navigation progress bar whenever route actually changes
  useEffect(() => {
    if (navigatingElRef.current) {
      navigatingElRef.current.classList.remove("ut-navigating");
      navigatingElRef.current = null;
    }
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = null;
    }

    setNavState((prev) => {
      if (prev === "loading") {
        if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = setTimeout(() => {
          setNavState("idle");
        }, 320);
        return "finishing";
      }
      return "idle";
    });
  }, [pathname, searchKey]);

  // Global tactile press, clipped ripple, haptic feedback & navigation bar trigger
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const triggerPress = (targetEl: HTMLElement) => {
      targetEl.classList.add("ut-pressed");
      window.setTimeout(() => {
        targetEl.classList.remove("ut-pressed");
      }, 170);
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Ignore right-click / non-primary mouse buttons
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const rawTarget = e.target as HTMLElement | null;
      if (!rawTarget || typeof rawTarget.closest !== "function") return;

      const interactive = rawTarget.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (!interactive) return;

      // Skip hidden or huge full-page wrapper links
      const rect = interactive.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.width > window.innerWidth * 0.92 && rect.height > window.innerHeight * 0.65) return;

      // 1. Instant tactile press animation (works reliably on fast mobile taps too)
      if (!prefersReducedMotion) {
        triggerPress(interactive);

        // 2. Clipped ripple overlay in fixed viewport portal (zero DOM mutation on the button itself!)
        const style = window.getComputedStyle(interactive);
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const maxDist = Math.max(
          Math.hypot(clickX, clickY),
          Math.hypot(rect.width - clickX, clickY),
          Math.hypot(clickX, rect.height - clickY),
          Math.hypot(rect.width - clickX, rect.height - clickY)
        );
        const size = Math.max(maxDist * 2.15, 44);
        const id = ++rippleIdRef.current;

        const newRipple: RippleOverlay = {
          id,
          rectTop: rect.top,
          rectLeft: rect.left,
          rectWidth: rect.width,
          rectHeight: rect.height,
          borderRadius: style.borderRadius || "8px",
          clickX,
          clickY,
          size,
          isLightBg: isLightBackground(interactive),
        };

        setRipples((prev) => [...prev.slice(-4), newRipple]);
        window.setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 460);
      }

      // 3. Subtle haptic pulse on supported mobile devices (Android)
      if (e.pointerType === "touch" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(8);
        } catch {
          // Ignore if browser blocks vibration
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }

      const rawTarget = e.target as HTMLElement | null;
      if (!rawTarget || typeof rawTarget.closest !== "function") return;

      const anchor = rawTarget.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("upi:") ||
        href.startsWith("phonepe:") ||
        href.startsWith("tez:") ||
        href.startsWith("paytmmp:") ||
        href.startsWith("javascript:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      // Only trigger route-loading bar for same-origin navigations to a different URL
      try {
        const dest = new URL(anchor.href, window.location.origin);
        if (dest.origin !== window.location.origin) return;
        const currentFull = window.location.pathname + window.location.search;
        const destFull = dest.pathname + dest.search;
        if (destFull === currentFull) return;

        // Start glowing top navigation bar immediately!
        if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
        if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);

        if (navigatingElRef.current) {
          navigatingElRef.current.classList.remove("ut-navigating");
        }
        anchor.classList.add("ut-navigating");
        navigatingElRef.current = anchor;

        setNavState("loading");

        // Safety fallback so bar can never stay stuck if route transition is aborted
        navTimeoutRef.current = setTimeout(() => {
          setNavState("idle");
          if (navigatingElRef.current) {
            navigatingElRef.current.classList.remove("ut-navigating");
            navigatingElRef.current = null;
          }
        }, 8000);
      } catch {
        // Ignore malformed URLs
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, { passive: true, capture: true });
    document.addEventListener("click", handleClick, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      document.removeEventListener("click", handleClick);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    };
  }, []);

  return (
    <>
      {/* ─── 1. Global Top Navigation Progress Bar (Instant Route Feedback) ─── */}
      {navState !== "idle" && (
        <div
          aria-hidden="true"
          className="fixed top-0 left-0 right-0 z-[99999] h-[3px] pointer-events-none overflow-hidden print:hidden"
        >
          <div
            className={`h-full bg-gradient-to-r from-[#26aadb] via-[#72ddfd] to-emerald-400 shadow-[0_0_12px_rgba(114,221,253,0.9),0_0_4px_rgba(38,170,219,1)] ${
              navState === "loading" ? "ut-nav-bar-loading" : "ut-nav-bar-finishing"
            }`}
          />
        </div>
      )}

      {/* ─── 2. Fixed Clipped Tactile Ripple Portals (Zero Layout Mutation) ─── */}
      {ripples.map((r) => (
        <div
          key={r.id}
          aria-hidden="true"
          className="fixed pointer-events-none z-[99998] overflow-hidden print:hidden"
          style={{
            top: `${r.rectTop}px`,
            left: `${r.rectLeft}px`,
            width: `${r.rectWidth}px`,
            height: `${r.rectHeight}px`,
            borderRadius: r.borderRadius,
          }}
        >
          <span
            className="ut-ripple-circle"
            style={{
              left: `${r.clickX - r.size / 2}px`,
              top: `${r.clickY - r.size / 2}px`,
              width: `${r.size}px`,
              height: `${r.size}px`,
              background: r.isLightBg
                ? "radial-gradient(circle, rgba(2, 13, 18, 0.28) 0%, rgba(2, 13, 18, 0.12) 55%, transparent 72%)"
                : "radial-gradient(circle, rgba(114, 221, 253, 0.45) 0%, rgba(255, 255, 255, 0.18) 55%, transparent 72%)",
            }}
          />
        </div>
      ))}
    </>
  );
}

export default function GlobalClickFeedback() {
  return (
    <Suspense fallback={null}>
      <GlobalClickFeedbackInner />
    </Suspense>
  );
}
