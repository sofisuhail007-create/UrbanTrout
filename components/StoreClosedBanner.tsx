"use client";

import { useEffect, useState, useCallback } from "react";

interface Props {
  nextOpenISO: string;   // ISO string of next open time (UTC)
  nextOpenLabel: string; // e.g. "tomorrow at 7:00 AM" or "tomorrow (Saturday) at 7:00 AM"
  primaryPhone: string;
  isFridayMaintenance?: boolean;
  closedReason?: "friday_maintenance" | "farm_maintenance" | "outside_hours" | "manual";
}

const C = {
  bg: "#031018",
  bgLow: "#06151e",
  bgHigh: "#10212c",
  primary: "#72ddfd",
  primaryCont: "#3aadcc",
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
  outlineVar: "#3d4a53",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getCountdown(targetISO: string) {
  if (!targetISO) return { h: 0, m: 0, s: 0, done: true };
  const diff = Math.max(0, new Date(targetISO).getTime() - Date.now());
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s, done: diff === 0 };
}

export default function StoreClosedBanner({
  nextOpenISO,
  nextOpenLabel,
  primaryPhone,
  isFridayMaintenance,
  closedReason,
}: Props) {
  const [countdown, setCountdown] = useState(() => getCountdown(nextOpenISO));
  const [isOpeningNow, setIsOpeningNow] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const isFarmMaintenance = closedReason === "farm_maintenance";
  // Determine if closed for Friday maintenance
  const isFridayNow = !isFarmMaintenance && (isFridayMaintenance !== undefined
    ? isFridayMaintenance
    : (() => {
        const utcMs = Date.now();
        const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
        return new Date(utcMs + istOffsetMs).getUTCDay() === 5;
      })());

  const isManualClose = !isFarmMaintenance && !isFridayNow && (!nextOpenISO || nextOpenLabel === "when we reopen" || closedReason === "manual");
  const isAnyMaintenance = isFarmMaintenance || isFridayNow;

  // Purge any local navigation cache and reload the page cleanly
  const triggerReload = useCallback((msg?: string) => {
    setIsOpeningNow(true);
    if (msg) setStatusMessage(msg);

    if (typeof window !== "undefined") {
      try {
        if ("caches" in window) {
          caches.keys().then((keys) => {
            keys.forEach((key) => {
              caches.open(key).then((cache) => {
                cache.delete(window.location.href);
                cache.delete(window.location.pathname);
                cache.delete("/shop");
                cache.delete("/shop/whole-trout");
                cache.delete("/shop/gutted-trout");
              });
            });
          });
        }
      } catch {
        // ignore cache delete errors
      }

      // Reload page to fetch live store content
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  }, []);

  useEffect(() => {
    // 1. If target open time has already elapsed, store is open right now (e.g. stale cache or tab resume)
    if (!isManualClose && nextOpenISO) {
      const diff = new Date(nextOpenISO).getTime() - Date.now();
      if (diff <= 0) {
        triggerReload("Store is now open! Loading fresh catch...");
        return;
      }
    }

    // 2. Countdown timer ticker
    let timerId: ReturnType<typeof setInterval> | null = null;
    if (!isManualClose && nextOpenISO) {
      timerId = setInterval(() => {
        const next = getCountdown(nextOpenISO);
        setCountdown(next);
        if (next.done) {
          if (timerId) clearInterval(timerId);
          triggerReload("Opening hours arrived! Loading store...");
        }
      }, 1000);
    }

    // 3. Status checker function to query the server
    const checkLiveStoreStatus = async () => {
      try {
        const res = await fetch(`/api/store-status?t=${Date.now()}`, {
          cache: "no-store",
          headers: { Pragma: "no-cache" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.isOpen) {
            triggerReload("Store is now open! Loading fresh catch...");
          }
        }
      } catch {
        // ignore network error
      }
    };

    // 4. Tab reactivation listeners (handles unlocking phone, returning from other tabs/apps, bfcache)
    const onTabActive = () => {
      if (document.visibilityState === "visible") {
        if (!isManualClose && nextOpenISO && Date.now() >= new Date(nextOpenISO).getTime()) {
          triggerReload("Welcome back! Store is now open, loading...");
        } else {
          checkLiveStoreStatus();
        }
      }
    };

    document.addEventListener("visibilitychange", onTabActive);
    window.addEventListener("pageshow", onTabActive);
    window.addEventListener("focus", onTabActive);

    // 5. Periodic polling every 20s (catches manual admin reopen or scheduled clock rollover)
    const pollId = setInterval(checkLiveStoreStatus, 20000);

    return () => {
      if (timerId) clearInterval(timerId);
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onTabActive);
      window.removeEventListener("pageshow", onTabActive);
      window.removeEventListener("focus", onTabActive);
    };
  }, [nextOpenISO, isManualClose, triggerReload]);

  const whatsappUrl = `https://wa.me/${primaryPhone.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Urban Trout, I'd like to place an order. When will you be available?")}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: "7.5rem",
        paddingBottom: "4rem",
        paddingLeft: "1.5rem",
        paddingRight: "1.5rem",
        position: "relative",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Ambient glow blobs */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(114,221,253,0.06) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          right: "-10%",
          width: "400px",
          height: "400px",
          background: "radial-gradient(circle, rgba(58,173,204,0.04) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
          filter: "blur(60px)",
        }}
      />

      {/* Content card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "580px",
          width: "100%",
          margin: "auto 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.75rem",
          textAlign: "center",
        }}
      >
        {/* Animated moon / maintenance orb */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "0.5rem" }}>
          {/* Outer pulse ring */}
          <div
            style={{
              position: "absolute",
              width: "130px",
              height: "130px",
              borderRadius: "50%",
              border: isAnyMaintenance ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(114,221,253,0.15)",
              animation: "orb-pulse 3s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "105px",
              height: "105px",
              borderRadius: "50%",
              border: isAnyMaintenance ? "1px solid rgba(248,113,113,0.18)" : "1px solid rgba(114,221,253,0.1)",
              animation: "orb-pulse 3s ease-in-out infinite 0.5s",
            }}
          />
          {/* Core orb */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: isAnyMaintenance
                ? "radial-gradient(circle at 35% 35%, rgba(248,113,113,0.22) 0%, rgba(239,68,68,0.06) 60%, transparent 100%)"
                : "radial-gradient(circle at 35% 35%, rgba(114,221,253,0.25) 0%, rgba(58,173,204,0.08) 60%, transparent 100%)",
              border: isAnyMaintenance ? "1.5px solid rgba(248,113,113,0.4)" : "1px solid rgba(114,221,253,0.3)",
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isAnyMaintenance
                ? "0 0 35px rgba(248,113,113,0.2), inset 0 0 20px rgba(248,113,113,0.1)"
                : "0 0 40px rgba(114,221,253,0.12), inset 0 0 20px rgba(114,221,253,0.08)",
            }}
          >
            {/* Moon / Maintenance / Sunrise Icon */}
            {isOpeningNow || countdown.done ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#72ddfd" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            ) : isAnyMaintenance ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#72ddfd" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "1px", background: "rgba(114,221,253,0.4)" }} />
            <span
              style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: "10px",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: isAnyMaintenance ? "#f87171" : C.primary,
              }}
            >
              {isFarmMaintenance ? "Facility Maintenance Mode" : isFridayNow ? "Weekly Maintenance Day" : "Store Status"}
            </span>
            <div style={{ width: "28px", height: "1px", background: "rgba(114,221,253,0.4)" }} />
          </div>

          <h1
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: "clamp(2rem, 6vw, 3.25rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              color: C.onSurface,
              margin: 0,
            }}
          >
            We&apos;re{" "}
            <span
              style={{
                background: isAnyMaintenance
                  ? "linear-gradient(135deg, #f87171, #fca5a5)"
                  : "linear-gradient(135deg, #72ddfd, #c4ebff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {isOpeningNow || countdown.done
                ? "Opening Right Now!"
                : isManualClose
                ? "Taking a Break"
                : isAnyMaintenance
                ? "Closed for Farm Maintenance"
                : "Closed Right Now"}
            </span>
          </h1>

          <p
            style={{
              fontFamily: '"Manrope", sans-serif',
              fontSize: "1rem",
              color: C.onSurfVar,
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            {isOpeningNow || countdown.done ? (
              <span style={{ color: C.primary, fontWeight: 600 }}>
                {statusMessage || "Operating hours have arrived! Opening our fresh catch catalog..."}
              </span>
            ) : isManualClose ? (
              "Our store is temporarily closed for the day. We'll be back soon — follow us on WhatsApp for updates."
            ) : isFarmMaintenance ? (
              <>
                Our farm &amp; vending center are currently closed for scheduled maintenance, RAS filtration backwashing, and biosecurity sanitation.
                <br />
                <strong style={{ color: C.onSurface }}>Fresh catch ordering will resume {nextOpenLabel || "as soon as maintenance concludes"}.</strong>
              </>
            ) : isFridayNow ? (
              <>
                Our farm is closed on Fridays for weekly farm maintenance and bio-security protocols.
                <br />
                We are open all other days (Saturday to Thursday, 7:00 AM – 10:00 PM).
                <br />
                <strong style={{ color: C.onSurface }}>Fresh catch ordering opens {nextOpenLabel}.</strong>
              </>
            ) : (
              <>
                Our store is currently closed. We harvest fresh trout to order during business hours only.
                <br />
                <strong style={{ color: C.onSurface }}>Opens {nextOpenLabel}.</strong>
              </>
            )}
          </p>
        </div>

        {/* Countdown timer / Loading state — only shown when auto-closed by hours */}
        {!isManualClose && (
          <div
            style={{
              width: "100%",
              padding: "1.5rem 1.75rem",
              background: "rgba(16,33,44,0.85)",
              borderRadius: "20px",
              border: isFridayNow ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(61,74,83,0.6)",
              backdropFilter: "blur(20px)",
              boxShadow: isFridayNow
                ? "0 8px 40px rgba(0,0,0,0.35), 0 0 30px rgba(248,113,113,0.06)"
                : "0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(114,221,253,0.05)",
            }}
          >
            {isOpeningNow || countdown.done ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "1rem 0" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    border: "3px solid rgba(114,221,253,0.2)",
                    borderTopColor: C.primary,
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <span
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    color: C.primary,
                  }}
                >
                  Loading Store...
                </span>
                <span
                  style={{
                    fontFamily: '"Inter", sans-serif',
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: C.onSurfVar,
                  }}
                >
                  Refreshing live inventory
                </span>
              </div>
            ) : (
              <>
                <p
                  style={{
                    fontFamily: '"Inter", sans-serif',
                    fontSize: "9px",
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: C.onSurfVar,
                    marginBottom: "1.5rem",
                    margin: "0 0 1.25rem",
                  }}
                >
                  Opens in
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  {/* Hours */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "72px" }}>
                    <span
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "clamp(2.25rem, 7vw, 3.5rem)",
                        fontWeight: 800,
                        letterSpacing: "-0.04em",
                        color: C.primary,
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {pad2(countdown.h)}
                    </span>
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.onSurfVar }}>
                      Hours
                    </span>
                  </div>

                  {/* Separator */}
                  <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "2.5rem", fontWeight: 800, color: "rgba(114,221,253,0.4)", lineHeight: 1, marginTop: "-12px" }}>:</span>

                  {/* Minutes */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "72px" }}>
                    <span
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "clamp(2.25rem, 7vw, 3.5rem)",
                        fontWeight: 800,
                        letterSpacing: "-0.04em",
                        color: C.primary,
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {pad2(countdown.m)}
                    </span>
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.onSurfVar }}>
                      Minutes
                    </span>
                  </div>

                  {/* Separator */}
                  <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "2.5rem", fontWeight: 800, color: "rgba(114,221,253,0.4)", lineHeight: 1, marginTop: "-12px" }}>:</span>

                  {/* Seconds */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "72px" }}>
                    <span
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "clamp(2.25rem, 7vw, 3.5rem)",
                        fontWeight: 800,
                        letterSpacing: "-0.04em",
                        color: C.onSurface,
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {pad2(countdown.s)}
                    </span>
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.onSurfVar }}>
                      Seconds
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Quick Refresh Button */}
            <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(61,74,83,0.4)" }}>
              <button
                type="button"
                onClick={() => {
                  setIsCheckingStatus(true);
                  triggerReload("Checking store status & refreshing...");
                }}
                disabled={isCheckingStatus || isOpeningNow}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "0.55rem 1.25rem",
                  borderRadius: "10px",
                  background: "rgba(114, 221, 253, 0.08)",
                  border: "1px solid rgba(114, 221, 253, 0.25)",
                  color: C.primary,
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  cursor: isCheckingStatus || isOpeningNow ? "wait" : "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(114, 221, 253, 0.16)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(114, 221, 253, 0.45)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(114, 221, 253, 0.08)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(114, 221, 253, 0.25)";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animation: isCheckingStatus || isOpeningNow ? "spin 1s linear infinite" : "none",
                  }}
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                {isCheckingStatus || isOpeningNow ? "Checking Status..." : "Refresh Shop Status 🔄"}
              </button>
            </div>
          </div>
        )}

        {/* Business hours info */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.85rem",
            width: "100%",
          }}
        >
          {/* Hours badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "0.75rem 1.25rem",
              background: "rgba(114,221,253,0.06)",
              border: "1px solid rgba(114,221,253,0.2)",
              borderRadius: "12px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#72ddfd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.onSurfVar, margin: "0 0 2px" }}>Farm Operating Schedule</p>
              <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.88rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>Sat – Thu: 7:00 AM – 10:00 PM</p>
              <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", fontWeight: 600, color: "#f87171", margin: "2px 0 0" }}>Closed Fridays (Farm Maintenance)</p>
            </div>
          </div>

          {/* Location badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "0.75rem 1.25rem",
              background: "rgba(114,221,253,0.06)",
              border: "1px solid rgba(114,221,253,0.2)",
              borderRadius: "12px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#72ddfd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.onSurfVar, margin: "0 0 2px" }}>Farm Location</p>
              <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.88rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>Malabagh, Srinagar</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", width: "100%" }}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "0.9rem 2rem",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #25d366, #128c7e)",
              color: "#fff",
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: "0.85rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(37,211,102,0.3)",
              transition: "opacity 0.2s",
              width: "100%",
              maxWidth: "320px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
            </svg>
            Message Us on WhatsApp
          </a>

          <p
            style={{
              fontFamily: '"Manrope", sans-serif',
              fontSize: "0.78rem",
              color: C.onSurfVar,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            For urgent orders or bulk inquiries, message us on WhatsApp.
            <br />
            We&apos;ll confirm availability for the next available slot.
          </p>
        </div>
      </div>

      {/* Keyframe animation via style tag */}
      <style>{`
        @keyframes orb-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
