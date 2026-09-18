export type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  unit: string;
  img: string;
  label: string;
  desc: string;
  minQuantity?: number;
  // Fields used by dynamically added products from DB
  image_url?: string;
  description?: string;
  /** Total aquarium biomass available (shared pool for all products) */
  stockKg?: number;
  /** Whether the shop is currently within operating hours (7 AM–10 PM IST) */
  isOpen?: boolean;
};

export const products: Product[] = [
  {
    id: "gutted-trout",
    name: "Premium Gutted Rainbow Trout",
    price: 550,
    originalPrice: 650,
    unit: "Kg",
    label: "CLEANED & GUTTED",
    desc: "Expertly cleaned, gutted, and ready to cook. Harvested fresh to order and chilled for delivery.",
    img: "/images/gutted_trout_premium.webp",
    minQuantity: 2,
  },
  {
    id: "whole-trout",
    name: "Whole Rainbow Trout",
    price: 500,
    originalPrice: 600,
    unit: "Kg",
    label: "WHOLE FRESH FISH",
    desc: "Fresh whole trout straight from our farm. Ideal for pan-frying, roasting, grilling, or curries.",
    img: "/images/whole_trout.jpg",
    minQuantity: 2,
  },
];
