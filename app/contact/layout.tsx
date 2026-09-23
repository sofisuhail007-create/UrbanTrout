import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us & Farm Location in Srinagar",
  description:
    "Contact Urban Trout Aquaculture Farm in Malabagh, Srinagar. Call or WhatsApp +91 84910 06127 for fresh harvest orders, farm visits, and restaurant supply.",
  alternates: {
    canonical: "https://urbantrout.in/contact",
  },
  openGraph: {
    title: "Contact Urban Trout | Farm Location & Support in Srinagar",
    description:
      "Get in touch with Urban Trout. Live trout vending center in Srinagar. 100% Free delivery across Srinagar.",
    url: "https://urbantrout.in/contact",
    siteName: "Urban Trout",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Contact Urban Trout Farm in Srinagar",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
