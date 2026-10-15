import { supabase } from "@/lib/supabase";
import { products, Product } from "@/lib/data";

const PRODUCT_META: Record<string, { label: string; desc: string; img: string }> = {
  "gutted-trout": {
    label: "CLEANED & GUTTED",
    desc: "Expertly cleaned, gutted, and pan-ready. Delivered ice-chilled across Srinagar within 2 hours of harvest.",
    img: "/images/gutted_trout_premium.webp",
  },
  "whole-trout": {
    label: "WHOLE FRESH FISH",
    desc: "Fresh whole rainbow trout straight from cold spring water. Ideal for grilling, frying, or roasting.",
    img: "/images/whole_trout.jpg",
  },
};

export async function getCatalogProducts(aquariumStockKg?: number, isOpen = true): Promise<Product[]> {
  try {
    const { data: invData } = await supabase
      .from("inventory")
      .select("*")
      .eq("available", true)
      .order("product_name");

    const { data: metaRows } = await supabase
      .from("app_settings")
      .select("*")
      .like("key", "product_meta_%");

    const metaMap: Record<string, any> = {};
    (metaRows || []).forEach((r) => {
      try {
        metaMap[r.key.replace("product_meta_", "")] = JSON.parse(r.value);
      } catch (e) {}
    });

    if (invData && invData.length > 0) {
      return invData.map((item) => {
        const hardcoded = PRODUCT_META[item.product_id];
        const savedMeta = metaMap[item.product_id] || {};
        const price = Number(item.price_per_kg);
        const originalPrice = item.original_price_per_kg
          ? Number(item.original_price_per_kg)
          : savedMeta.original_price_per_kg
          ? Number(savedMeta.original_price_per_kg)
          : item.product_id === "gutted-trout"
          ? 650
          : item.product_id === "whole-trout"
          ? 600
          : Math.round(price * 1.2);
        const minQuantity = item.min_order_kg
          ? Number(item.min_order_kg)
          : savedMeta.min_order_kg
          ? Number(savedMeta.min_order_kg)
          : 2;

        return {
          id: item.product_id,
          name: item.product_name,
          price,
          originalPrice,
          unit: "Kg",
          label: (item as any).label || savedMeta.label || hardcoded?.label || "FRESH TROUT",
          desc:
            (item as any).description ||
            savedMeta.description ||
            hardcoded?.desc ||
            "Fresh premium farm trout harvested to order.",
          img:
            (item as any).image_url ||
            savedMeta.image_url ||
            hardcoded?.img ||
            "/images/gutted_trout_premium.png",
          minQuantity,
          stockKg: aquariumStockKg,
          isOpen,
        };
      });
    }
  } catch (err) {
    console.error("Failed to load catalog products from supabase:", err);
  }

  return products.map((p) => ({
    ...p,
    stockKg: aquariumStockKg,
    isOpen,
  }));
}
