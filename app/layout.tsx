import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ClientWidgets from "@/components/ClientWidgets";
import { CartProvider } from "@/context/CartContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
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
  display: "optional",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
  adjustFontFallback: true,
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "optional",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://urbantrout.in"),
  title: {
    default: "Fresh Rainbow Trout in Srinagar from ₹540/kg | Urban Trout",
    template: "%s | Urban Trout",
  },
  description:
    "Farm-harvested rainbow trout, delivered chilled in Srinagar. Whole ₹540/kg, cleaned & gutted ₹580/kg. Min 2 kg. Order online or pick up at Malabagh farm.",
  openGraph: {
    title: "Fresh Rainbow Trout in Srinagar from ₹540/kg | Urban Trout",
    description:
      "Farm-harvested rainbow trout, delivered chilled in Srinagar. Whole ₹540/kg, cleaned & gutted ₹580/kg. Min 2 kg. Order online or pick up.",
    url: "https://urbantrout.in",
    siteName: "Urban Trout",
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
    title: "Buy Fresh Rainbow Trout in Srinagar | Urban Trout",
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
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://urbantrout.in/#website",
      "url": "https://urbantrout.in/",
      "name": "Urban Trout",
      "alternateName": ["Urban Trout Srinagar", "UrbanTrout", "Urban Trout Aquaculture"],
      "publisher": {
        "@id": "https://urbantrout.in/#organization"
      },
      "inLanguage": "en-IN"
    },
    {
      "@type": ["LocalBusiness", "FishStore", "Store", "Organization"],
      "@id": "https://urbantrout.in/#organization",
      "name": "Urban Trout",
      "alternateName": ["Urban Trout Srinagar", "ٹراؤٹ مچھلی سرینگر", "ट्राउट मछली श्रीनगर"],
      "image": "https://urbantrout.in/images/og-image.png",
      "logo": "https://urbantrout.in/sitelogo.png",
      "description": "Srinagar's premier cold-water aquaculture farm located in Malabagh. Producing fresh whole and cleaned Rainbow Trout (Oncorhynchus mykiss) harvested live to order with rapid chilled delivery within 2 hours across Srinagar.",
      "url": "https://urbantrout.in",
      "telephone": "+918491006127",
      "email": "info.urbantrout@gmail.com",
      "founder": {
        "@type": "Person",
        "name": "Skindar Mohd Sideeq"
      },
      "priceRange": "₹540 - ₹580 per Kg",
      "currenciesAccepted": "INR",
      "paymentAccepted": "Cash on Delivery, UPI, Debit Card, Credit Card, Net Banking",
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
        "opens": "07:00",
        "closes": "22:00"
      },
      "servesCuisine": "Freshwater Trout, Himalayan Fish, Seafood",
      "areaServed": [
        {
          "@type": "City",
          "name": "Srinagar",
          "containedInPlace": {
            "@type": "State",
            "name": "Jammu and Kashmir"
          }
        }
      ],
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Fresh Rainbow Trout Catalog",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Product",
              "name": "Whole Fresh Rainbow Trout",
              "alternateName": "Oncorhynchus mykiss",
              "image": "https://urbantrout.in/images/whole_trout.jpg",
              "description": "Live harvest whole Rainbow Trout raised in pure cold groundwater in Malabagh, Srinagar. Harvested to order.",
              "sku": "whole-trout",
              "offers": {
                "@type": "Offer",
                "price": "540",
                "priceCurrency": "INR",
                "availability": "https://schema.org/InStock",
                "priceValidUntil": "2027-12-31",
                "url": "https://urbantrout.in/shop/whole-trout"
              }
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Product",
              "name": "Cleaned & Gutted Rainbow Trout",
              "alternateName": "Oncorhynchus mykiss",
              "image": "https://urbantrout.in/images/gutted_trout_premium.webp",
              "description": "Descaled, cleaned, and gutted fresh Rainbow Trout. 100% pan-ready with delicate skin and rich Omega-3 content.",
              "sku": "gutted-trout",
              "offers": {
                "@type": "Offer",
                "price": "580",
                "priceCurrency": "INR",
                "availability": "https://schema.org/InStock",
                "priceValidUntil": "2027-12-31",
                "url": "https://urbantrout.in/shop/gutted-trout"
              }
            }
          }
        ]
      }
    }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${manrope.variable}`}>
      <head>
        <link
          rel="preload"
          href="/images/hero-trout-bg.webp"
          as="image"
          type="image/webp"
          fetchPriority="high"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* ─── Facebook Pixel Base Code ──────────────────────────────── */}
        {process.env.NEXT_PUBLIC_FB_PIXEL_ID && (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${process.env.NEXT_PUBLIC_FB_PIXEL_ID}');
fbq('track', 'PageView');
                `.trim(),
              }}
            />
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_FB_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </head>
      <body className={`${manrope.className} bg-[#031018] text-[#dfedf9] antialiased selection:bg-cyan-500/20 selection:text-cyan-300`}>
        <CustomerAuthProvider>
          <CartProvider>
            <Toaster 
              position="bottom-center"
              toastOptions={{
                style: {
                  background: '#10212c',
                  color: '#dfedf9',
                  border: '1px solid #3d4a53',
                  fontFamily: 'var(--font-manrope), sans-serif',
                  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
                },
              }}
            />
          <Navbar />
          {children}
          <ClientWidgets />
          <Footer />
          <Analytics />
          <SpeedInsights />
          {/* ─── PWA Service Worker Global Registration ─────────────────── */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function() {});
                  });
                  if (document.readyState === 'complete') {
                    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function() {});
                  }
                }
              `.trim(),
            }}
          />
        </CartProvider>
      </CustomerAuthProvider>
    </body>
    </html>
  );
}
