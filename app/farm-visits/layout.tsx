import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plan Your Farm Visit | Urban Trout Srinagar",
  description:
    "Pre-notify and schedule your farm visit to Urban Trout in Malabagh, Naseem Bagh, Srinagar. Experience cold-water trout aquaculture, live fish picking, and on-site harvest.",
  alternates: {
    canonical: "https://urbantrout.in/farm-visits",
  },
  openGraph: {
    title: "Plan Your Farm Visit | Urban Trout Srinagar",
    description:
      "Pre-notify your visit to Urban Trout's cold-water trout farm in Srinagar. Free entry, live raceway tours, and fresh harvest to order.",
    url: "https://urbantrout.in/farm-visits",
    siteName: "Urban Trout Srinagar",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Urban Trout Farm Visit - Naseem Bagh, Srinagar",
      },
    ],
  },
};

export default function FarmVisitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
