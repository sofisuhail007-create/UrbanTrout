"use client";

import React from "react";

export default function WholesaleForm() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const businessName = formData.get("businessName");
    const industryType = formData.get("industryType");
    const contactPerson = formData.get("contactPerson");
    const volume = formData.get("volume");
    const requirements = formData.get("requirements");

    const message = `*NEW B2B WHOLESALE INQUIRY* 🏢🐟

*Business Details:*
Name: ${businessName}
Type: ${industryType}
Contact Person: ${contactPerson}

*Order Requirements:*
Est. Weekly Volume: ${volume}
Specific Requirements: ${requirements || "None specified."}

_Sent via Urban Trout Wholesale Portal_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/917006604148?text=${encodedMessage}`, '_blank');
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest block mb-2">
            Business Name
          </label>
          <input
            type="text"
            name="businessName"
            required
            placeholder="The Lalit / Taj Vivanta"
            className="w-full bg-transparent border-b border-outline/30 focus:border-primary outline-none py-2 text-on-surface transition-all placeholder:text-outline-variant/40"
          />
        </div>
        <div>
          <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest block mb-2">
            Industry Type
          </label>
          <select name="industryType" className="w-full bg-transparent border-b border-outline/30 focus:border-primary outline-none py-2 text-on-surface appearance-none transition-all [&>option]:bg-surface-container-high [&>option]:text-on-surface">
            <option>Luxury Hotel</option>
            <option>Fine Dining Restaurant</option>
            <option>Wholesale Distributor</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest block mb-2">
            Contact Person
          </label>
          <input
            type="text"
            name="contactPerson"
            required
            placeholder="Executive Chef"
            className="w-full bg-transparent border-b border-outline/30 focus:border-primary outline-none py-2 text-on-surface transition-all placeholder:text-outline-variant/40"
          />
        </div>
        <div>
          <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest block mb-2">
            Est. Weekly Volume
          </label>
          <input
            type="text"
            name="volume"
            required
            placeholder="e.g. 50kg"
            className="w-full bg-transparent border-b border-outline/30 focus:border-primary outline-none py-2 text-on-surface transition-all placeholder:text-outline-variant/40"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest block mb-2">
          Specific Requirements
        </label>
        <textarea
          name="requirements"
          rows={3}
          placeholder="Details about preferred sizing, harvest days, or specific cuts..."
          className="w-full bg-transparent border-b border-outline/30 focus:border-primary outline-none py-2 text-on-surface transition-all placeholder:text-outline-variant/40 resize-none"
        />
      </div>
      <button
        type="submit"
        className="w-full py-5 bg-[#25D366] text-white font-headline font-bold text-lg rounded-md hover:brightness-110 transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(37,211,102,0.3)]"
      >
        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
        </svg>
        Submit Inquiry via WhatsApp
      </button>
      <p className="text-[10px] text-center text-outline uppercase tracking-widest opacity-60 mt-4">
        Your data is secured by urban trout precision protocols.
      </p>
    </form>
  );
}
