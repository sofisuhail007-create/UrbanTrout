"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Lead } from "@/lib/supabase";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  abandoned: { label: "Abandoned Lead", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
  contacted: { label: "Contacted", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  converted: { label: "Converted / Ordered", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
  lost: { label: "Lost / Not Interested", color: "text-slate-400", bg: "bg-slate-500/15 border-slate-500/30" },
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setLeads(data as Lead[]);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleStatusChange = async (leadId: string, newStatus: Lead["status"]) => {
    setUpdatingId(leadId);
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (!error) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateNotes = async (leadId: string, notes: string) => {
    try {
      await supabase
        .from("leads")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", leadId);
    } catch (err) {
      console.error("Failed to update notes:", err);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (!error) {
        setLeads(prev => prev.filter(l => l.id !== leadId));
      }
    } catch (err) {
      console.error("Failed to delete lead:", err);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesFilter = filter === "all" || lead.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      (lead.customer_name?.toLowerCase().includes(q) ?? false) ||
      lead.customer_phone.includes(q) ||
      (lead.customer_locality?.toLowerCase().includes(q) ?? false);
    return matchesFilter && matchesSearch;
  });

  const totalAbandoned = leads.filter(l => l.status === "abandoned").length;
  const totalConverted = leads.filter(l => l.status === "converted").length;
  const pipelineValue = leads
    .filter(l => l.status === "abandoned" || l.status === "contacted")
    .reduce((acc, l) => acc + (Number(l.estimated_total) || 0), 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">phone_callback</span>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Leads & Abandoned Checkouts
            </h1>
          </div>
          <p className="text-slate-400 text-sm mt-1" style={{ fontFamily: '"Manrope", sans-serif' }}>
            Auto-captured customers who started the checkout process. Call or WhatsApp to close the sale.
          </p>
        </div>

        <button
          onClick={fetchLeads}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors border border-slate-700 self-start"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Abandoned Carts</p>
          <p className="text-3xl font-extrabold text-amber-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{totalAbandoned}</p>
          <p className="text-xs text-slate-500 mt-1">Pending follow-up call</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Potential Revenue</p>
          <p className="text-3xl font-extrabold text-cyan-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>₹{pipelineValue.toLocaleString("en-IN")}</p>
          <p className="text-xs text-slate-500 mt-1">From unclosed leads</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Converted Orders</p>
          <p className="text-3xl font-extrabold text-emerald-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{totalConverted}</p>
          <p className="text-xs text-slate-500 mt-1">Successfully placed orders</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: `All (${leads.length})` },
            { id: "abandoned", label: `Abandoned (${totalAbandoned})` },
            { id: "contacted", label: "Contacted" },
            { id: "converted", label: `Converted (${totalConverted})` },
            { id: "lost", label: "Lost" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filter === tab.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-sm">search</span>
          <input
            type="text"
            placeholder="Search by name, phone, locality..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64 pl-9 pr-4 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Loading leads…</div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <span className="material-symbols-outlined text-4xl text-slate-700 block mb-2">person_search</span>
            No leads found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Contact Actions</th>
                  <th className="px-4 py-3.5">Cart Items</th>
                  <th className="px-4 py-3.5">Est. Total</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Notes</th>
                  <th className="px-4 py-3.5">Captured</th>
                  <th className="px-3 py-3.5 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeads.map((lead) => {
                  const itemsList = Array.isArray(lead.cart_items) ? lead.cart_items : [];
                  const itemsSummary = itemsList.map((i: any) => `${i.name} (${i.quantity} ${i.unit || 'Kg'})`).join(", ") || "Cart in progress";
                  const waText = encodeURIComponent(
                    `Hi ${lead.customer_name || 'there'}! This is Urban Trout Srinagar. We noticed you started an order for fresh Rainbow Trout (${itemsSummary || 'Fresh Catch'}). Would you like us to confirm and arrange same-day delivery to your location?`
                  );

                  return (
                    <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Customer Info */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-white text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                          {lead.customer_name || "Guest Customer"}
                        </div>
                        <div className="text-slate-400 text-xs font-mono mt-0.5">
                          +91 {lead.customer_phone}
                        </div>
                        {lead.customer_locality && (
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            📍 {lead.customer_locality} {lead.customer_pincode ? `(${lead.customer_pincode})` : ''}
                          </div>
                        )}
                      </td>

                      {/* Instant Contact Buttons */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {/* Call Button */}
                          <a
                            href={`tel:+91${lead.customer_phone}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-semibold transition-all border border-cyan-500/30 text-xs"
                            title="Call Customer Now"
                          >
                            <span className="material-symbols-outlined text-[14px]">call</span>
                            Call
                          </a>

                          {/* WhatsApp Button */}
                          <a
                            href={`https://wa.me/91${lead.customer_phone}?text=${waText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold transition-all border border-emerald-500/30 text-xs"
                            title="Send WhatsApp Follow-up"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                            </svg>
                            WhatsApp
                          </a>
                        </div>
                      </td>

                      {/* Cart Items */}
                      <td className="px-4 py-4 max-w-[200px]">
                        <div className="text-slate-300 font-medium truncate" title={itemsSummary}>
                          {itemsSummary}
                        </div>
                      </td>

                      {/* Est. Total */}
                      <td className="px-4 py-4 font-bold text-cyan-400 font-mono">
                        ₹{Number(lead.estimated_total || 0).toLocaleString("en-IN")}
                      </td>

                      {/* Status Selector */}
                      <td className="px-4 py-4">
                        <select
                          value={lead.status}
                          disabled={updatingId === lead.id}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as any)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none bg-slate-950 cursor-pointer ${
                            STATUS_CONFIG[lead.status]?.bg || 'bg-slate-900'
                          } ${STATUS_CONFIG[lead.status]?.color || 'text-white'}`}
                        >
                          <option value="abandoned">Abandoned</option>
                          <option value="contacted">Contacted</option>
                          <option value="converted">Converted</option>
                          <option value="lost">Lost</option>
                        </select>
                      </td>

                      {/* Notes input */}
                      <td className="px-4 py-4">
                        <input
                          type="text"
                          defaultValue={lead.notes || ""}
                          placeholder="Add call notes…"
                          onBlur={(e) => handleUpdateNotes(lead.id, e.target.value)}
                          className="bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 w-36 placeholder:text-slate-700 focus:outline-none focus:border-cyan-500/40"
                        />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-4 text-right">
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          className="text-slate-600 hover:text-red-400 transition-colors p-1"
                          title="Delete Lead"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
