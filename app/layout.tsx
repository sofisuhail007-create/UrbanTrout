import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Manrope, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ClientWidgets from "@/components/ClientWidgets";
import { CartProvider } from "@/context/CartContext";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#031018",
};

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://urbantrout.in"),
  title: {
    default: "Urban Trout | Buy Fresh Rainbow Trout in Srinagar | Home Delivery",
    template: "%s | Urban Trout Srinagar",
  },
  description:
    "Order fresh Rainbow Trout in Srinagar. Harvested to order from our cold-water farm in Malabagh & delivered within 2 hours to your doorstep. Zero antibiotics, pure filtered water.",
  keywords: [
    "trout fish in srinagar",
    "buy trout online srinagar",
    "fresh rainbow trout kashmir",
    "trout fish price in srinagar",
    "trout home delivery srinagar",
    "best fish in srinagar",
    "trout farm srinagar",
    "trout farm malabagh",
    "cleaned gutted trout srinagar",
    "fresh fish delivery kashmir",
    "rainbow trout rate per kg srinagar",
    "buy fish online kashmir",
    "trout fish near me srinagar",
    "Urban Trout",
  ],
  alternates: {
    canonical: "https://urbantrout.in",
  },
  openGraph: {
    title: "Urban Trout | Fresh Rainbow Trout in Srinagar",
    description:
      "Order fresh Rainbow Trout in Srinagar. Farmed in clean borewell water in Malabagh. Harvested fresh to order with rapid delivery within 2 hours.",
    url: "https://urbantrout.in",
    siteName: "Urban Trout Srinagar",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        secureUrl: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "Urban Trout - Buy Fresh Rainbow Trout in Srinagar",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Urban Trout | Fresh Rainbow Trout in Srinagar",
    description: "Farm-fresh Rainbow Trout harvested to order in Srinagar. Same-day chilled home delivery.",
    images: ["https://urbantrout.in/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/sitelogo.png", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  verification: {
    google: "t_h48-dHHohnXh8_rwiI8IS-Z2eANoRrIuJLO3devGU",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "Store"],
  "name": "Urban Trout",
  "alternateName": "Urban Trout Srinagar",
  "image": "https://urbantrout.in/images/og-image.png",
  "description": "Srinagar's premier cold-water trout farm located in Malabagh. Providing fresh whole and cleaned Rainbow Trout harvested to order with rapid delivery within 2 hours across Srinagar, Kashmir.",
  "@id": "https://urbantrout.in",
  "url": "https://urbantrout.in",
  "telephone": "+918491006127",
  "email": "info.urbantrout@gmail.com",
  "priceRange": "₹500 - ₹600 per Kg",
  "currenciesAccepted": "INR",
  "paymentAccepted": "Cash, UPI, Online Payment Link",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Malabagh, Near R P School (Girls Wing)",
    "addressLocality": "Srinagar",
    "addressRegion": "Jammu and Kashmir",
    "postalCode": "190006",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 34.144709,
    "longitude": 74.824525
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    ],
    "opens": "08:00",
    "closes": "20:00"
  },
  "servesCuisine": "Seafood, Freshwater Fish",
  "areaServed": [
    { "@type": "AdministrativeArea", "name": "Srinagar Delivery Zone (from Malabagh Farm)" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${manrope.variable} ${inter.variable}`}>
      <head>
        <link
          rel="preload"
          href="/fonts/material-symbols-outlined.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${manrope.className} bg-[#031018] text-[#dfedf9] antialiased selection:bg-cyan-500/20 selection:text-cyan-300`}>
        <CartProvider>
          <Toaster 
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#10212c',
                color: '#dfedf9',
                border: '1px solid #3d4a53',
                fontFamily: 'var(--font-manrope), sans-serif',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)'
              },
            }}
          />
          <Navbar />
          {children}
          <ClientWidgets />
          <Footer />
          <Analytics />
          <SpeedInsights />
        </CartProvider>
      </body>
    </html>
  );
}
