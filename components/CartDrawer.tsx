"use client";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function CartDrawer() {
  const { isOpen, closeCart, items, removeItem, updateQuantity, total } =
    useCart();

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] transition-opacity"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 h-full w-full max-w-sm z-[60] bg-slate-950/95 backdrop-blur-2xl shadow-[-10px_0_30px_rgba(0,0,0,0.5)] flex flex-col border-l border-white/5 transition-transform duration-500 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-bold text-cyan-400 font-headline">
              Your Selection
            </h2>
            <p className="text-xs text-slate-500 uppercase tracking-widest mt-1 font-label">
              Premium Srinagar Stock
            </p>
          </div>
          <button
            onClick={closeCart}
            className="material-symbols-outlined text-slate-400 hover:text-white transition-colors p-1"
            aria-label="Close cart"
          >
            close
          </button>
        </div>

        {/* Items */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 opacity-40">
              <span className="material-symbols-outlined text-5xl text-slate-500">
                set_meal
              </span>
              <p className="text-slate-400 font-body">
                Your cart is empty.
                <br />
                Add fresh trout to start.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 p-4 rounded-xl bg-surface-container-high border border-white/5"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-variant flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium text-on-surface">
                      {item.name}
                    </h4>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-slate-500 hover:text-error transition-colors ml-2"
                      aria-label="Remove item"
                    >
                      <span className="material-symbols-outlined text-sm">
                        close
                      </span>
                    </button>
                  </div>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1 font-label">
                    ₹{item.price} / {item.unit}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center bg-surface-container-highest rounded p-0.5 border border-outline-variant/20">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="w-7 h-7 flex items-center justify-center text-primary hover:bg-primary/10 rounded transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">
                          remove
                        </span>
                      </button>
                      <span className="w-8 text-center font-label text-sm font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="w-7 h-7 flex items-center justify-center text-primary hover:bg-primary/10 rounded transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">
                          add
                        </span>
                      </button>
                    </div>
                    <span className="text-sm font-bold text-primary font-label">
                      ₹{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-white/5 p-6 space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs text-on-surface-variant uppercase tracking-widest font-label">
                  Packaging (Bio-Thermal)
                </span>
                <p className="text-xs text-on-surface-variant font-label mt-1">
                  ₹45.00 flat
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-label">
                  Total Payable
                </p>
                <h3 className="text-2xl font-headline font-bold text-primary neon-glow-text">
                  ₹{(total + 45).toLocaleString("en-IN")}
                </h3>
              </div>
            </div>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="block w-full py-4 bg-primary-container text-on-primary-container font-headline font-bold uppercase tracking-widest rounded-md hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(58,173,204,0.3)] text-center"
            >
              Proceed to Checkout
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
