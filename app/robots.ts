import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/checkout", "/account/", "/api/", "/invoice/"],
    },
    sitemap: "https://urbantrout.in/sitemap.xml",
  };
}
