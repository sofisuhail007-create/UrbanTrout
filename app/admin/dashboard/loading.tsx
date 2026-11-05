export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#020d12] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-xs">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg shadow-cyan-500/10">
          <svg className="w-6 h-6 animate-spin text-cyan-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-wide" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            URBAN TROUT ADMIN
          </p>
          <p className="text-xs text-slate-400 font-mono mt-1">Loading dashboard interface…</p>
        </div>
      </div>
    </div>
  );
}
