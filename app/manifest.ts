import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Urban Trout - Buy Fresh Rainbow Trout in Srinagar",
    short_name: "Urban Trout",
    description:
      "Order fresh Rainbow Trout in Srinagar. Farmed in clean water in Naseem Bagh & delivered same-day.",
    start_url: "/",
    display: "standalone",
    background_color: "#031018",
    theme_color: "#031018",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sitelogo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Order Fresh Trout",
        short_name: "Shop",
        url: "/shop",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Our Cold-Water Farm",
        short_name: "Our Farm",
        url: "/our-farm",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Book Farm Visit",
        short_name: "Visit Us",
        url: "/farm-visits",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
