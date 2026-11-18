export default function ShopLoading() {
  return (
    <div
      className="min-h-screen pt-28 pb-20 px-4 sm:px-6"
      style={{ background: "#031018" }}
      aria-busy="true"
      aria-label="Loading fresh trout catalog"
    >
      <div className="max-w-6xl mx-auto animate-pulse">
        {/* Header skeleton */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <div className="h-6 w-48 rounded-full bg-cyan-500/15 border border-cyan-500/20 mx-auto" />
          <div className="h-10 sm:h-12 w-3/4 rounded-xl bg-white/10 mx-auto" />
          <div className="h-4 w-5/6 rounded-lg bg-white/5 mx-auto" />
        </div>

        {/* Product cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl overflow-hidden border border-white/10 bg-[#0d1e29]/90"
            >
              <div className="w-full aspect-[16/9] bg-gradient-to-br from-cyan-950/60 to-slate-900/60" />
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="h-6 w-2/3 rounded-lg bg-white/10" />
                  <div className="h-7 w-24 rounded-lg bg-cyan-400/20" />
                </div>
                <div className="space-y-2">
                  <div className="h-3.5 w-full rounded bg-white/5" />
                  <div className="h-3.5 w-5/6 rounded bg-white/5" />
                </div>
                <div className="pt-2 flex items-center gap-3">
                  <div className="h-11 flex-1 rounded-xl bg-cyan-500/20" />
                  <div className="h-11 w-28 rounded-xl bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
