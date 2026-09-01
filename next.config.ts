import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js", "react-hot-toast", "lucide-react"],
  },
  async redirects() {
    return [
      {
        source: "/about",
        destination: "/our-farm",
        permanent: true,
      },
      {
        source: "/about-us",
        destination: "/our-farm",
        permanent: true,
      },
      {
        source: "/refund",
        destination: "/refund-policy",
        permanent: true,
      },
      {
        source: "/refunds",
        destination: "/refund-policy",
        permanent: true,
      },
      {
        source: "/cancellation-policy",
        destination: "/refund-policy",
        permanent: true,
      },
      {
        source: "/cancellation-refund-policy",
        destination: "/refund-policy",
        permanent: true,
      },
      {
        source: "/shipping",
        destination: "/shipping-policy",
        permanent: true,
      },
      {
        source: "/delivery-policy",
        destination: "/shipping-policy",
        permanent: true,
      },
      {
        source: "/shipping-delivery-policy",
        destination: "/shipping-policy",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
