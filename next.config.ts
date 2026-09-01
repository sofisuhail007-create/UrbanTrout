import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/aida-public/**",
      },
    ],
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
