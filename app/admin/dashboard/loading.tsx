export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#020d12] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-xs">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg shadow-cyan-500/10">
          <span className="material-symbols-outlined text-2xl animate-spin">sync</span>
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
