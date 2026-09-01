import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Space_Grotesk, Manrope, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CartProvider } from "@/context/CartContext";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Optimized Dynamic Preload for non-critical interactive widgets
const CartDrawer = dynamic(() => import("@/components/CartDrawer"));
const WhatsAppButton = dynamic(() => import("@/components/WhatsAppButton"));
const LiveChatWidget = dynamic(() => import("@/components/LiveChatWidget"));

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    "Order fresh Rainbow Trout in Srinagar. Harvested to order from our cold-water farm in Naseem Bagh & delivered same-day to your doorstep. Zero antibiotics, pure filtered water.",
  keywords: [
    "trout fish in srinagar",
    "buy trout online srinagar",
    "fresh rainbow trout kashmir",
    "trout fish price in srinagar",
    "trout home delivery srinagar",
    "best fish in srinagar",
    "trout farm srinagar",
    "trout farm naseem bagh",
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
      "Order fresh Rainbow Trout in Srinagar. Farmed in clean borewell water in Naseem Bagh. Harvested fresh to order with same-day delivery.",
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
  "description": "Srinagar's premier cold-water trout farm & live vending center located in Malabagh, Naseem Bagh. Providing fresh whole and cleaned Rainbow Trout harvested to order with delivery across a 5km radius in Srinagar, Kashmir.",
  "@id": "https://urbantrout.in",
  "url": "https://urbantrout.in",
  "telephone": "+918491006127",
  "email": "info.urbantrout@gmail.com",
  "priceRange": "₹500 - ₹600 per Kg",
  "currenciesAccepted": "INR",
  "paymentAccepted": "Cash, UPI, Online Payment Link",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Malabagh, Naseem Bagh, Near R P School (Girls Wing)",
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
    { "@type": "AdministrativeArea", "name": "5km Radius from Farm (Malabagh, Naseem Bagh, Srinagar)" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${manrope.variable} ${inter.variable}`}>
      <head>
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
          <CartDrawer />
          {children}
          <WhatsAppButton />
          <LiveChatWidget />
          <Footer />
          <Analytics />
          <SpeedInsights />
        </CartProvider>
      </body>
    </html>
  );
}
