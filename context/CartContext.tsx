"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { fbAddToCart } from "@/lib/fbpixel";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  unit: string;
  image: string;
  minQuantity?: number;
  maxQuantity?: number;
};

type CartContextType = {
  items: CartItem[];
  isOpen: boolean;
  aquariumStockKg: number | null;
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

const isAquariumItem = (id: string) => id === "gutted-trout" || id === "whole-trout";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [aquariumStockKg, setAquariumStockKg] = useState<number | null>(null);

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

      // If cart is empty on initial visit, avoid blocking initial load with network calls
      if (loadedItems.length === 0) {
        setItems([]);
        setIsInitialized(true);
        return;
      }

      // Fetch live inventory and live aquarium stock
      let invList: any[] = [];
      let liveStockVal: number | null = null;
      try {
        const res = await fetch("/api/inventory");
        if (res.ok) {
          const json = await res.json();
          if (json?.success && Array.isArray(json.inventory)) {
            invList = json.inventory;
          }
          if (json?.aquariumStockKg !== undefined && json?.aquariumStockKg !== null) {
            liveStockVal = Number(json.aquariumStockKg);
            setAquariumStockKg(liveStockVal);
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

      // If cart has existing items that exceed real live stock, clamp them immediately
      if (liveStockVal !== null && liveStockVal >= 0 && loadedItems.length > 0) {
        const maxPool = Math.floor(liveStockVal);
        let remainingBudget = maxPool;
        loadedItems = loadedItems.map((item) => {
          if (!isAquariumItem(item.id)) return item;
          const min = Math.max(1, Number(item.minQuantity) || 1);
          const allowed = Math.max(min, Math.min(item.quantity, remainingBudget));
          remainingBudget = Math.max(0, remainingBudget - allowed);
          return {
            ...item,
            quantity: allowed,
            maxQuantity: maxPool,
          };
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
    const maxStock = aquariumStockKg !== null && isAquariumItem(item.id)
      ? Math.floor(aquariumStockKg)
      : (item.maxQuantity || 99);

    setItems((prev) => {
      // Combined shared pool check for aquarium trout
      const otherAquariumQty = prev
        .filter((i) => isAquariumItem(i.id) && i.id !== item.id)
        .reduce((sum, i) => sum + i.quantity, 0);

      const remainingAllowance = Math.max(0, maxStock - otherAquariumQty);
      if (isAquariumItem(item.id) && remainingAllowance < min) {
        alert(`Cannot add more trout. Total aquarium stock is ${maxStock} kg, and your cart already contains ${otherAquariumQty} kg.`);
        return prev;
      }

      const existing = prev.find((i) => i.id === item.id);
      const requestedTotal = existing ? existing.quantity + item.quantity : item.quantity;
      const clampedTotal = Math.min(requestedTotal, isAquariumItem(item.id) ? remainingAllowance : maxStock);
      const finalQty = Math.max(min, clampedTotal);

      const validItem: CartItem = {
        ...item,
        minQuantity: min,
        maxQuantity: maxStock,
        quantity: finalQty,
      };

      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: finalQty } : i));
      }
      return [...prev, validItem];
    });

    try {
      fbAddToCart({
        value: item.price * (item.quantity || 1),
        contentName: item.name,
        contentId: item.id,
      });
    } catch (_) {}

    setIsOpen(true);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (!target) return prev;
      const min = Math.max(1, Number(target.minQuantity) || 1);
      const maxStock = aquariumStockKg !== null && isAquariumItem(id)
        ? Math.floor(aquariumStockKg)
        : (target.maxQuantity || 99);

      const otherAquariumQty = prev
        .filter((i) => isAquariumItem(i.id) && i.id !== id)
        .reduce((sum, i) => sum + i.quantity, 0);

      const remainingAllowance = Math.max(min, maxStock - otherAquariumQty);
      const safeQty = Math.max(min, Math.min(qty, isAquariumItem(id) ? remainingAllowance : maxStock));

      return prev.map((i) => (i.id === id ? { ...i, quantity: safeQty } : i));
    });
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
        aquariumStockKg,
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
