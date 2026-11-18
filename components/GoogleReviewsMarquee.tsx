"use client";

import { useState } from "react";
import type { GoogleReviewsData, GoogleReviewItem } from "@/lib/reviews";

function GoogleGIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
      />
    </svg>
  );
}

function getInitials(name: string): string {
  const parts = (name || "U").trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || "UT").toUpperCase();
}

function ReviewCard({
  review,
  mapsUrl,
  floatVariant,
}: {
  review: GoogleReviewItem;
  mapsUrl: string;
  floatVariant: "a" | "b";
}) {
  return (
    <a
      href={review.authorUrl || mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative flex-shrink-0 w-[300px] sm:w-[350px] p-5 sm:p-6 rounded-2xl bg-[#0a1622]/90 backdrop-blur-md border border-cyan-500/15 hover:border-cyan-400/50 shadow-[0_12px_36px_rgba(0,0,0,0.45)] hover:shadow-[0_16px_44px_rgba(38,170,219,0.16)] flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-1.5 ${
        floatVariant === "a" ? "ut-float-card-a" : "ut-float-card-b"
      }`}
    >
      {/* Subtle top cyan highlight */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

      <div className="space-y-3">
        {/* Top Row: Stars + Google Verified Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5 text-amber-400 text-sm tracking-wide">
            {"★".repeat(Math.min(5, Math.max(1, Math.round(review.rating || 5))))}
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono text-slate-300">
            <GoogleGIcon className="w-3 h-3" />
            <span>{review.source === "google" ? "Live Google" : "Verified"}</span>
          </span>
        </div>

        {/* Review Body */}
        <p className="text-[12.5px] sm:text-[13px] text-slate-200/90 leading-relaxed font-sans italic line-clamp-4">
          &ldquo;{review.text}&rdquo;
        </p>
      </div>

      {/* Reviewer Footer */}
      <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {review.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.photoUrl}
              alt={review.author}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover border border-cyan-400/30 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/25 to-blue-600/25 border border-cyan-400/30 flex items-center justify-center text-[11px] font-bold text-cyan-200 font-mono flex-shrink-0">
              {getInitials(review.author)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate font-['Space_Grotesk']">
              {review.author}
            </div>
            <div className="text-[10.5px] text-cyan-400/90 font-mono truncate">
              {review.locality || "Srinagar, J&K"}
            </div>
          </div>
        </div>
        {review.relativeTime && (
          <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap flex-shrink-0">
            {review.relativeTime === "Verified Google Review" ? "★★★★★" : review.relativeTime}
          </span>
        )}
      </div>
    </a>
  );
}

export default function GoogleReviewsMarquee({
  reviewsData,
}: {
  reviewsData: GoogleReviewsData;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const items = reviewsData.items && reviewsData.items.length > 0 ? reviewsData.items : [];
  const targetReviewsUrl = reviewsData.reviewsUri || reviewsData.mapsUrl;

  // Repeat items so the marquee loop is always wide and completely seamless on ultrawide monitors
  const trackItems = items.length < 4 ? [...items, ...items] : items;
  // Adaptive duration (~6.5s per card for relaxed, readable floating pace)
  const durationSec = Math.max(28, trackItems.length * 6.5);

  return (
    <div className="relative w-full">
      {/* ─── Official Live Google Maps AI Review Summary (Synced via Places API New) ─── */}
      {reviewsData.reviewSummary && (
        <div className="max-w-3xl mx-auto px-4 mb-6">
          <a
            href={targetReviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0c1d2c]/90 via-[#081520]/90 to-[#0a1622]/90 border border-cyan-400/25 hover:border-cyan-400/50 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="inline-flex items-center gap-2">
                <GoogleGIcon className="w-4 h-4" />
                <span className="text-xs font-bold text-white tracking-wide font-['Space_Grotesk']">
                  Live Google Maps Consensus
                </span>
                <span className="text-amber-400 text-xs font-mono font-bold">
                  {Number(reviewsData.rating).toFixed(1)} ★ ({reviewsData.reviewCount})
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[10px] font-mono text-cyan-300">
                <span>✨</span>
                <span>Summarized by Google Gemini</span>
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-slate-200/90 leading-relaxed font-sans">
              &ldquo;{reviewsData.reviewSummary}&rdquo;
            </p>
          </a>
        </div>
      )}

      {/* ─── Moving Floating Marquee Viewport with Soft Edge Fade Masks ─── */}
      <div
        className="relative w-full overflow-hidden py-4"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div
          className="ut-reviews-marquee-track flex items-stretch gap-5 sm:gap-6 w-max"
          style={{
            animationDuration: `${durationSec}s`,
            animationPlayState: isPaused ? "paused" : "running",
          }}
        >
          {/* Set 1 */}
          {trackItems.map((review, idx) => (
            <ReviewCard
              key={`a-${review.id}-${idx}`}
              review={review}
              mapsUrl={targetReviewsUrl}
              floatVariant={idx % 2 === 0 ? "a" : "b"}
            />
          ))}
          {/* Set 2 (Seamless infinite clone) */}
          {trackItems.map((review, idx) => (
            <ReviewCard
              key={`b-${review.id}-${idx}`}
              review={review}
              mapsUrl={targetReviewsUrl}
              floatVariant={idx % 2 === 0 ? "a" : "b"}
            />
          ))}
        </div>
      </div>

      {/* ─── Bottom Controls & Verified Google Action Strip ─── */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 px-4">
        <a
          href={targetReviewsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 text-slate-200 text-xs font-semibold transition-all"
        >
          <GoogleGIcon className="w-3.5 h-3.5" />
          <span>Read All {reviewsData.reviewCount} Google Reviews</span>
          <span className="text-cyan-400">↗</span>
        </a>
        <a
          href={reviewsData.reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-cyan-200 text-xs font-bold transition-all"
        >
          <span>★</span>
          <span>Write a Review</span>
        </a>
        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 text-slate-400 hover:text-white text-[11px] font-mono transition-all cursor-pointer"
          title={isPaused ? "Resume floating reviews" : "Pause floating reviews"}
        >
          <span>{isPaused ? "▶ Resume" : "❚❚ Pause"}</span>
        </button>
      </div>
    </div>
  );
}
