import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plan Your Farm Visit | Urban Trout Srinagar",
  description:
    "Pre-notify and schedule your farm visit to Urban Trout Aquaculture Farm in Malabagh, Srinagar. Experience modern cold-water trout aquaculture and farm-fresh harvest.",
  alternates: {
    canonical: "https://urbantrout.in/farm-visits",
  },
  openGraph: {
    title: "Plan Your Farm Visit | Urban Trout Srinagar",
    description:
      "Pre-notify your visit to Urban Trout's cold-water borewell trout farm in Srinagar. Free entry, raceway tank tours, and live catch harvested to order.",
    url: "https://urbantrout.in/farm-visits",
    siteName: "Urban Trout Srinagar",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Urban Trout Aquaculture Farm Visit - Malabagh, Srinagar",
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
