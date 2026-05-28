"use client";
import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function CheckoutPage() {
  const { items, total, updateQuantity } = useCart();
  const [deliveryMode, setDeliveryMode] = useState<"under5" | "over5" | "unavailable" | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");

  const deliveryFee = deliveryMode === "over5" ? 40 : 0;
  const grandTotal = total + deliveryFee;

  const FARM_LAT = 34.144831;
  const FARM_LNG = 74.824280;
  const SRINAGAR_MAX_RADIUS_KM = 25; // Approximate radius covering Srinagar city limits

  // Haversine formula to calculate distance in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const detectLocation = () => {
    setIsLocating(true);
    setLocationMsg("Locating...");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const distanceInKm = calculateDistance(FARM_LAT, FARM_LNG, userLat, userLng);
          
          if (distanceInKm > SRINAGAR_MAX_RADIUS_KM) {
            setDeliveryMode("unavailable");
            setLocationMsg(`Out of zone (${distanceInKm.toFixed(1)}km away). We only deliver within Srinagar.`);
          } else {
            const isClose = distanceInKm <= 5;
            setDeliveryMode(isClose ? "under5" : "over5");
            setLocationMsg(
              isClose 
                ? `Within 5km (${distanceInKm.toFixed(1)}km away) - Free Delivery` 
                : `Outside 5km (${distanceInKm.toFixed(1)}km away) - ₹40 Fee`
            );
          }
          setIsLocating(false);
        },
        (error) => {
          setLocationMsg("Please allow location access.");
          setIsLocating(false);
        }
      );
    } else {
      setLocationMsg("Geolocation not supported.");
      setIsLocating(false);
    }
  };

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left: Checkout Form */}
        <section className="lg:col-span-7 space-y-8">
          <div className="flex items-center gap-4">
            <Link
              href="/shop"
              className="flex items-center justify-center w-10 h-10 rounded-md border border-outline-variant/30 text-on-surface-variant hover:border-primary/50 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                arrow_back
              </span>
            </Link>
            <h1 className="font-headline text-3xl font-bold text-on-surface tracking-tight">
              Checkout
            </h1>
          </div>

          <div className="glass-panel p-8 rounded-xl space-y-10 border border-primary/10">
            {/* Auto Distance Calculator */}
            <div className="flex flex-wrap items-center justify-between p-5 bg-surface-container-high rounded-xl border border-primary/10 gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-label text-xs uppercase tracking-widest text-primary-fixed flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">my_location</span>
                  Smart Delivery Pricing
                </span>
                {deliveryMode ? (
                  <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    deliveryMode === "under5" ? "bg-primary/10 border-primary/30 text-primary-fixed" :
                    deliveryMode === "over5" ? "bg-surface-variant border-outline-variant/30 text-on-surface" :
                    "bg-error/10 border-error/30 text-error"
                  }`}>
                    <span className="material-symbols-outlined text-sm">
                      {deliveryMode === "under5" ? "check_circle" : deliveryMode === "over5" ? "local_shipping" : "cancel"}
                    </span>
                    <span className="text-sm font-medium">{locationMsg}</span>
                  </div>
                ) : (
                  <span className="text-sm text-on-surface-variant font-light mt-1">
                    {locationMsg || "Calculate delivery charges automatically"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={detectLocation}
                disabled={isLocating}
                className="px-5 py-2.5 text-xs font-label uppercase tracking-wider rounded-lg transition-all bg-primary-container text-on-primary-container hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
              >
                {isLocating ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                    Detecting...
                  </>
                ) : (
                  <>Detect Location</>
                )}
              </button>
            </div>

            <form id="checkout-form" className="space-y-8" onSubmit={(e) => {
              e.preventDefault();
              if (!deliveryMode || deliveryMode === "unavailable") {
                alert("Please calculate a valid delivery zone first.");
                return;
              }

              const formData = new FormData(e.currentTarget);
              const fullName = formData.get("fullName");
              const phone = formData.get("phone");
              const locality = formData.get("locality");
              const house = formData.get("house");
              const pincode = formData.get("pincode");

              let cartDetails = "";
              items.forEach(item => {
                cartDetails += `- ${item.name} (${item.quantity} ${item.unit}): ₹${(item.price * item.quantity).toLocaleString("en-IN")}\n`;
              });

              const message = `*NEW HARVEST REQUEST* 🐟\n\n*Customer Details:*\nName: ${fullName}\nPhone: +91 ${phone}\nAddress: ${house}, ${locality}, ${pincode}\n\n*Requested Items:*\n${cartDetails}*Delivery Zone:* ${deliveryMode === "over5" ? "Outside 5km (₹" + deliveryFee + ")" : "Within 5km (Free)"}\n*Estimated Total:* ₹${grandTotal.toLocaleString("en-IN")}\n\n_Note: This is an estimated total. We will calculate the exact catch weight and send you the final invoice and payment link shortly._`;

              const encodedMessage = encodeURIComponent(message);
              window.open(`https://wa.me/917006604148?text=${encodedMessage}`, '_blank');
            }}>
              {/* Address */}
              <div>
                <h2 className="font-headline text-lg font-medium text-primary mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">
                    location_on
                  </span>
                  Srinagar Delivery Address
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                  {[
                    { label: "Full Name", name: "fullName", placeholder: "e.g. Sameer Ahmed", type: "text", span: false, required: true },
                    { label: "Phone Number (India)", name: "phone", placeholder: "10-digit mobile number", type: "tel", span: false, required: true, pattern: "[0-9]{10}", maxLength: 10, prefix: "+91" },
                    { label: "Locality / Landmark", name: "locality", placeholder: "Near Dal Lake, Boulevard Road", type: "text", span: true, required: true },
                    { label: "House No. / Building", name: "house", placeholder: "Plot 42, Sector B", type: "text", span: false, required: true },
                    { label: "Pin Code", name: "pincode", placeholder: "190001", type: "text", span: false, required: true },
                  ].map((f) => (
                    <div key={f.label} className={`flex flex-col ${f.span ? "md:col-span-2" : ""}`}>
                      <label className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-2 ml-1">
                        {f.label}
                        {f.required && <span className="text-error ml-1">*</span>}
                      </label>
                      <div className="relative flex items-center">
                        {f.prefix && (
                          <span className="absolute left-4 text-on-surface-variant font-medium">
                            {f.prefix}
                          </span>
                        )}
                        <input
                          type={f.type}
                          name={f.name}
                          required={f.required}
                          pattern={f.pattern}
                          maxLength={f.maxLength}
                          placeholder={f.placeholder}
                          className={`w-full bg-surface-container border border-outline-variant/30 rounded-lg py-3 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-body ${f.prefix ? "pl-12 pr-4" : "px-4"}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment */}
              <div>
                <h2 className="font-headline text-lg font-medium text-primary mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">
                    payments
                  </span>
                  Bespoke Payment Process
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  <label className="flex items-center gap-4 p-4 rounded-xl border border-primary/40 bg-primary/5 cursor-pointer transition-colors">
                    <input
                      defaultChecked
                      name="payment"
                      type="radio"
                      className="text-primary focus:ring-0"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Payment Link via WhatsApp</span>
                      <span className="text-xs text-on-surface-variant">Sent after exact harvest weight is calculated</span>
                    </div>
                    <span className="material-symbols-outlined ml-auto text-primary opacity-60">
                      link
                    </span>
                  </label>
                  
                  <div className="mt-2 p-5 rounded-xl bg-surface-container-low border border-outline-variant/10 flex gap-4 items-start">
                    <span className="material-symbols-outlined text-primary-fixed mt-0.5">
                      info
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold text-on-surface">Why do we do this?</span>
                      <span className="text-xs text-on-surface-variant leading-relaxed">
                        Because our trout is harvested exclusively to order, we cannot guarantee the exact weight (e.g. exactly 2.00 Kg) until it is pulled from the water. You will be billed for the exact catch weight via a secure payment link sent to your WhatsApp before delivery.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* Right: Order Summary */}
        <aside className="lg:col-span-5 sticky top-32 space-y-6">
          <div className="rounded-xl overflow-hidden shadow-2xl bg-surface-container-high border border-outline-variant/10">
            <div className="p-6 bg-surface-container-highest border-b border-white/5 flex items-center justify-between">
              <h2 className="font-headline text-xl font-bold">Order Summary</h2>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">{items.length} items</span>
            </div>
            <div className="p-6 space-y-6">
              {/* Items */}
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {items.length === 0 ? (
                  <p className="text-on-surface-variant text-sm text-center py-8">
                    Your cart is empty.{" "}
                    <Link href="/shop" className="text-primary hover:underline">
                      Shop now
                    </Link>
                    .
                  </p>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-16 h-16 rounded-md bg-surface-variant overflow-hidden flex-shrink-0 border border-outline-variant/20">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-medium leading-tight">{item.name}</h4>
                          <span className="text-sm font-label tracking-tight text-primary ml-4">
                            ₹{(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 bg-surface-variant/40 w-max rounded border border-outline-variant/30">
                          <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="w-7 h-6 flex items-center justify-center text-primary hover:bg-surface-variant transition-colors rounded-l">
                            −
                          </button>
                          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest min-w-[30px] text-center font-bold">
                            {item.quantity} {item.unit}
                          </span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-6 flex items-center justify-center text-primary hover:bg-surface-variant transition-colors rounded-r">
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="h-px bg-outline-variant/20" />

              {/* Calculations */}
              <div className="space-y-3 font-label text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Subtotal</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-primary">
                  <span className="flex items-center gap-2">
                    Delivery Fee
                    {deliveryMode === "under5" && <span className="text-[9px] bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">Under 5km</span>}
                    {deliveryMode === "over5" && <span className="text-[9px] bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">5km+</span>}
                    {deliveryMode === "unavailable" && <span className="text-[9px] bg-error/10 text-error px-1.5 py-0.5 rounded uppercase tracking-tighter">Not Deliverable</span>}
                  </span>
                  <span>
                    {deliveryMode === "unavailable" ? "---" : (deliveryFee === 0 ? "Free" : `₹${deliveryFee}`)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-primary/20">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-label mb-1">
                      Total Payable
                    </p>
                    <h3 className="text-3xl font-headline font-bold text-primary neon-glow-text">
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-error uppercase tracking-widest font-label mb-1">
                      Secure Checkout
                    </p>
                    <div className="flex gap-1 justify-end text-on-surface-variant opacity-50">
                      <span className="material-symbols-outlined text-[14px]">lock</span>
                      <span className="material-symbols-outlined text-[14px]">shield</span>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                form="checkout-form"
                disabled={items.length === 0 || !deliveryMode || deliveryMode === "unavailable"}
                className={`w-full py-4 font-headline font-bold uppercase tracking-widest rounded-lg transition-all mt-2 flex items-center justify-center gap-3 ${
                  items.length === 0 || !deliveryMode || deliveryMode === "unavailable"
                    ? "bg-surface-variant text-on-surface-variant opacity-50 cursor-not-allowed"
                    : "bg-[#25D366] text-white hover:brightness-110 active:scale-[0.98] shadow-[0_0_20px_rgba(37,211,102,0.3)]"
                }`}
              >
                {!deliveryMode 
                  ? "Detect Location First" 
                  : deliveryMode === "unavailable" 
                    ? "Out of Delivery Zone" 
                    : (
                      <>
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                        </svg>
                        Send Request via WhatsApp
                      </>
                    )}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
