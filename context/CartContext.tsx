"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  unit: string;
  image: string;
  minQuantity?: number;
};

type CartContextType = {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  openCart: () => void;
  closeCart: () => void;
  clearCart: () => void;
  total: number;
  originalTotal: number;
  totalSavings: number;
  itemCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. Load initial cart from localStorage & sync MOQ with live inventory
  useEffect(() => {
    async function initCart() {
      let loadedItems: CartItem[] = [];
      try {
        const stored = localStorage.getItem("urban_trout_cart");
        if (stored) loadedItems = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to load cart", e);
      }

      // Fetch live MOQ and price from inventory API/table to ensure cart respects current rules
      let invList: any[] = [];
      try {
        const res = await fetch("/api/inventory");
        if (res.ok) {
          const json = await res.json();
          if (json?.success && Array.isArray(json.inventory)) {
            invList = json.inventory;
          }
        }
      } catch (_) {}

      if (invList.length === 0) {
        try {
          const { data } = await supabase.from("inventory").select("*");
          if (data) invList = data;
        } catch (_) {}
      }

      if (invList.length > 0 && loadedItems.length > 0) {
        loadedItems = loadedItems.map((item) => {
          const inv = invList.find((i) => i.product_id === item.id);
          if (inv) {
            const liveMin = Math.max(1, Number(inv.min_order_kg) || 2);
            const liveOrigPrice = inv.original_price_per_kg
              ? Number(inv.original_price_per_kg)
              : item.originalPrice || (item.id === "gutted-trout" ? 650 : 600);
            return {
              ...item,
              price: inv.price_per_kg || item.price,
              originalPrice: liveOrigPrice,
              minQuantity: liveMin,
              quantity: Math.max(liveMin, item.quantity),
            };
          }
          return item;
        });
      }

      setItems(loadedItems);
      setIsInitialized(true);
    }
    initCart();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("urban_trout_cart", JSON.stringify(items));
    }
  }, [items, isInitialized]);

  const addItem = (item: CartItem) => {
    const min = Math.max(1, Number(item.minQuantity) || 1);
    const validItem = {
      ...item,
      minQuantity: min,
      quantity: Math.max(min, item.quantity),
    };

    setItems((prev) => {
      const existing = prev.find((i) => i.id === validItem.id);
      if (existing) {
        return prev.map((i) =>
          i.id === validItem.id ? { ...i, quantity: i.quantity + validItem.quantity } : i
        );
      }
      return [...prev, validItem];
    });
    setIsOpen(true);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const min = Math.max(1, Number(i.minQuantity) || 1);
          return { ...i, quantity: Math.max(min, qty) };
        }
        return i;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem("urban_trout_cart");
    } catch {}
  };

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const originalTotal = items.reduce(
    (sum, i) => sum + (i.originalPrice && i.originalPrice > i.price ? i.originalPrice : i.price) * i.quantity,
    0
  );
  const totalSavings = Math.max(0, originalTotal - total);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        addItem,
        removeItem,
        updateQuantity,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        clearCart,
        total,
        originalTotal,
        totalSavings,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
