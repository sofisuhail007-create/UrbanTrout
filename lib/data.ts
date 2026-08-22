export type Product = {
  id: string;
  name: string;
  price: number;
  unit: string;
  img: string;
  label: string;
  desc: string;
};

export const products: Product[] = [
  {
    id: "gutted-trout",
    name: "Premium Gutted Rainbow Trout",
    price: 550,
    unit: "Kg",
    label: "CLEANED & GUTTED",
    desc: "Expertly cleaned, gutted, and ready to cook. Harvested fresh to order and chilled for delivery.",
    img: "/images/gutted_trout_premium.png",
  },
  {
    id: "whole-trout",
    name: "Whole Rainbow Trout",
    price: 500,
    unit: "Kg",
    label: "WHOLE FRESH FISH",
    desc: "Fresh whole trout straight from our farm. Ideal for pan-frying, roasting, grilling, or curries.",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA6az_W5rdEt8WkOzLnn861EIuB2tv1E9ZBuYuxXAnLFmG7ZsCCb0WyuI___JpO7YjI9Vf_XYBLXYanCVvdJyrbf-CarB6-5xxisc34AV5zB1gV5AElNc-POwd_DAA12ADx0vUX87WKN2GVXZapRsMugASCSZsBjri-8d9uI957NqfLv1Hau8-DgJfLrNJoRtSKwJo6uFM1V-GDVCSznDSww8vBl8jD_s-iPkmhUcOhQ6ekndTbbBSJCBon4pCpkvihVwAcuF4JCTVc",
  },
];
