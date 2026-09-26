"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

export interface DbCustomer {
  id?: string;
  name: string;
  phone: string;
  locality?: string | null;
  pincode?: string | null;
  notes?: string | null;
  email?: string | null;
  total_orders?: number;
  total_spent?: number;
  last_order_at?: string | null;
}

interface CustomerAutocompleteInputProps {
  customerName: string;
  customerPhone: string;
  customerNotes?: string;
  customerEmail?: string;
  onNameChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onNotesChange?: (val: string) => void;
  onEmailChange?: (val: string) => void;
  customers: DbCustomer[];
  loadingCustomers?: boolean;
  notesLabel?: string;
  notesPlaceholder?: string;
  showNotesField?: boolean;
  showEmailField?: boolean;
  theme?: "emerald" | "cyan";
}

export default function CustomerAutocompleteInput({
  customerName,
  customerPhone,
  customerNotes = "",
  customerEmail = "",
  onNameChange,
  onPhoneChange,
  onNotesChange,
  onEmailChange,
  customers,
  loadingCustomers = false,
  notesLabel = "Packaging / Delivery Notes (Optional)",
  notesPlaceholder = "e.g. Extra iced, clean & cut into steaks",
  showNotesField = false,
  showEmailField = false,
  theme = "emerald",
}: CustomerAutocompleteInputProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeField, setActiveField] = useState<"name" | "phone" | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<DbCustomer | null>(null);
  const [browserModalOpen, setBrowserModalOpen] = useState(false);
  const [browserSearch, setBrowserSearch] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter matching customers when user types in name or phone
  const searchSuggestions = useMemo(() => {
    const qName = customerName.trim().toLowerCase();
    const cleanPhone = customerPhone.replace(/\D/g, "");

    if (qName.length < 2 && cleanPhone.length < 2) return [];

    return customers
      .filter((c) => {
        const cPhone = (c.phone || "").replace(/\D/g, "");
        const cName = (c.name || "").toLowerCase();

        const matchPhone = cleanPhone.length >= 2 && cPhone.includes(cleanPhone);
        const matchName = qName.length >= 2 && cName.includes(qName);

        return matchPhone || matchName;
      })
      .slice(0, 7);
  }, [customerName, customerPhone, customers]);

  // Filtered list for the Customer Browser Modal
  const browserList = useMemo(() => {
    const q = browserSearch.trim().toLowerCase();
    const cleanDigits = q.replace(/\D/g, "");

    if (!q) return customers.slice(0, 50);

    return customers
      .filter((c) => {
        const cName = (c.name || "").toLowerCase();
        const cPhone = (c.phone || "").replace(/\D/g, "");
        const cLoc = (c.locality || "").toLowerCase();
        return (
          cName.includes(q) ||
          cLoc.includes(q) ||
          (cleanDigits.length > 0 && cPhone.includes(cleanDigits))
        );
      })
      .slice(0, 50);
  }, [browserSearch, customers]);

  const handleSelect = (cust: DbCustomer) => {
    setSelectedCustomer(cust);
    onNameChange(cust.name || "");

    const cleanPh = (cust.phone || "").replace(/\D/g, "").slice(-10);
    onPhoneChange(cleanPh);

    if (onNotesChange && !customerNotes.trim() && cust.locality) {
      onNotesChange(cust.locality);
    }

    if (onEmailChange && cust.email) {
      onEmailChange(cust.email);
    }

    setDropdownOpen(false);
    setBrowserModalOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedCustomer(null);
    onNameChange("");
    onPhoneChange("");
    if (onNotesChange) onNotesChange("");
    if (onEmailChange) onEmailChange("");
  };

  const isEmerald = theme === "emerald";
  const focusBorder = isEmerald ? "focus:border-emerald-400" : "focus:border-cyan-400";
  const accentText = isEmerald ? "text-emerald-400" : "text-cyan-400";
  const accentBg = isEmerald ? "bg-emerald-500/20" : "bg-cyan-500/20";
  const accentBorder = isEmerald ? "border-emerald-500/40" : "border-cyan-500/40";

  return (
    <div ref={containerRef} className="space-y-2.5 relative">
      {/* Top Bar with Database Status & Quick Picker Button */}
      <div className="flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 uppercase font-bold tracking-wider text-[10px]">
            Customer Details
          </span>
          {customers.length > 0 && (
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
              {customers.length} in database
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setBrowserSearch("");
            setBrowserModalOpen(true);
          }}
          className={`px-2 py-0.5 rounded-lg ${accentBg} border ${accentBorder} ${accentText} text-[10.5px] font-bold hover:brightness-125 transition-all flex items-center gap-1 cursor-pointer`}
          title="Pick an existing customer with prefilled details"
        >
          <span className="material-symbols-outlined text-[13px]">person_search</span>
          <span>Pick Saved Customer</span>
        </button>
      </div>

      {/* Selected Customer Notification Pill */}
      {selectedCustomer && (
        <div className={`p-2 rounded-xl bg-slate-950 border ${accentBorder} flex items-center justify-between gap-2 animate-fadeIn shadow-sm`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-6 h-6 rounded-lg ${accentBg} ${accentText} flex items-center justify-center text-xs font-black shrink-0`}>
              ✓
            </div>
            <div className="min-w-0 text-left">
              <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                <span>{selectedCustomer.name}</span>
                <span className={`text-[10px] ${accentText} font-mono font-semibold`}>
                  (+91 {selectedCustomer.phone})
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {selectedCustomer.locality ? `📍 ${selectedCustomer.locality}` : "Existing Customer"}
                {selectedCustomer.total_orders ? ` • ${selectedCustomer.total_orders} orders` : ""}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearSelection}
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-[10px] font-mono border border-slate-800 cursor-pointer shrink-0 transition-colors"
            title="Clear and enter fresh details"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Name and Mobile Input Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Customer Name */}
        <div className="space-y-1 relative">
          <label className="text-[10.5px] font-bold text-slate-400 uppercase font-mono block">
            Customer Name:
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => {
              onNameChange(e.target.value);
              setActiveField("name");
              setDropdownOpen(true);
            }}
            onFocus={() => {
              setActiveField("name");
              if (searchSuggestions.length > 0) setDropdownOpen(true);
            }}
            placeholder="e.g. Mushtaq Ahmad"
            className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none ${focusBorder} font-mono`}
          />
        </div>

        {/* Customer Phone (WhatsApp) */}
        <div className="space-y-1 relative">
          <label className="text-[10.5px] font-bold text-slate-400 uppercase font-mono block">
            Mobile (WhatsApp):
          </label>
          <div className="relative">
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                onPhoneChange(val);
                setActiveField("phone");
                setDropdownOpen(true);
              }}
              onFocus={() => {
                setActiveField("phone");
                if (searchSuggestions.length > 0) setDropdownOpen(true);
              }}
              placeholder="10-digit mobile"
              maxLength={10}
              className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none ${focusBorder} font-mono`}
            />
            {customerPhone.length === 10 && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${accentText} text-xs font-bold font-mono`}>
                ✓
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Autocomplete Dropdown */}
      {dropdownOpen && searchSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl p-1.5 space-y-1 max-h-56 overflow-y-auto animate-fadeIn backdrop-blur-xl">
          <div className="px-2 py-1 text-[9.5px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
            <span>Matching Customers in Database:</span>
            <span className="text-[9px] text-slate-500">Tap to prefill</span>
          </div>

          {searchSuggestions.map((cust) => {
            const cleanPh = (cust.phone || "").replace(/\D/g, "");
            return (
              <button
                key={cust.id || cleanPh}
                type="button"
                onClick={() => handleSelect(cust)}
                className="w-full text-left p-2 rounded-xl hover:bg-slate-900/90 active:bg-slate-800 transition-colors flex items-center justify-between gap-2 cursor-pointer border border-transparent hover:border-slate-800"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg ${accentBg} ${accentText} flex items-center justify-center font-bold text-xs shrink-0 font-mono`}>
                    {(cust.name || "C")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                      <span>{cust.name || "Customer"}</span>
                      {cust.total_orders && cust.total_orders > 1 ? (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                          {cust.total_orders} orders
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {cust.locality ? `📍 ${cust.locality}` : "Customer"}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-xs font-mono font-bold ${accentText}`}>
                    +91 {cleanPh}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Optional Delivery Notes / Address */}
      {showNotesField && onNotesChange && (
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase font-mono block">
            {notesLabel}:
          </label>
          <input
            type="text"
            value={customerNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={notesPlaceholder}
            className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none ${focusBorder} font-mono`}
          />
        </div>
      )}

      {/* Optional Email Field */}
      {showEmailField && onEmailChange && (
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase font-mono block">
            Customer Email (Optional):
          </label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="customer@email.com"
            className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none ${focusBorder} font-mono`}
          />
        </div>
      )}

      {/* ─── FULL CUSTOMER BROWSER MODAL ─── */}
      {browserModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setBrowserModalOpen(false);
          }}
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn"
        >
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-md p-4 sm:p-5 space-y-3 shadow-2xl relative text-left max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined ${accentText} text-xl`}>
                  group
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Select Saved Customer</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Prefills name, 10-digit WhatsApp phone and address
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBrowserModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs font-black cursor-pointer border border-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Search Filter Box */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base">
                search
              </span>
              <input
                type="text"
                value={browserSearch}
                onChange={(e) => setBrowserSearch(e.target.value)}
                placeholder="Search name, phone number or locality..."
                autoFocus
                className={`w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none ${focusBorder} font-mono`}
              />
              {browserSearch && (
                <button
                  type="button"
                  onClick={() => setBrowserSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[200px]">
              {loadingCustomers ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  <span>Loading customers from database...</span>
                </div>
              ) : browserList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono">
                  No matching customers found.
                </div>
              ) : (
                browserList.map((cust) => {
                  const cleanPh = (cust.phone || "").replace(/\D/g, "");
                  const isCurrent = (customerPhone || "").replace(/\D/g, "") === cleanPh;
                  return (
                    <button
                      key={cust.id || cleanPh}
                      type="button"
                      onClick={() => handleSelect(cust)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isCurrent
                          ? `${accentBg} ${accentBorder} shadow-sm`
                          : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                          <span>{cust.name || "Customer"}</span>
                          {cust.locality && (
                            <span className="text-[9.5px] text-slate-400 font-mono truncate">
                              • {cust.locality}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                          <span className={accentText}>+91 {cleanPh}</span>
                          {cust.total_orders ? (
                            <span className="text-slate-500">
                              ({cust.total_orders} {cust.total_orders === 1 ? "order" : "orders"})
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <span className={`text-[11px] font-bold ${accentText} shrink-0 font-mono`}>
                        {isCurrent ? "✓ Selected" : "Select →"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Showing {browserList.length} customers</span>
              <button
                type="button"
                onClick={() => setBrowserModalOpen(false)}
                className="text-slate-400 hover:text-white underline cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
