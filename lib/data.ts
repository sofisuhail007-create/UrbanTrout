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
  /** Whether the shop is currently within operating hours (8 AM–8 PM IST) */
  isOpen?: boolean;
};

export const products: Product[] = [
  {
    id: "gutted-trout",
    name: "Premium Gutted Rainbow Trout (Chef-Cut Pieces)",
    price: 580,
    originalPrice: 650,
    unit: "Kg",
    label: "CLEANED & CHEF-CUT",
    desc: "Expertly descaled, gutted, and pre-cut into pan-ready chef portions by default. Harvested fresh to order and packed in 100% food-grade biodegradable polythene (0% ice) for express delivery.",
    img: "/images/gutted-trout-v2.webp",
    minQuantity: 1,
  },
  {
    id: "whole-trout",
    name: "Whole Rainbow Trout",
    price: 540,
    originalPrice: 600,
    unit: "Kg",
    label: "WHOLE FRESH FISH",
    desc: "Fresh whole trout straight from our farm. Ideal for pan-frying, roasting, grilling, or curries.",
    img: "/images/whole-trout-v2.webp",
    minQuantity: 1,
  },
];
