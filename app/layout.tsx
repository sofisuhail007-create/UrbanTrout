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
    "Fresh Rainbow Trout in Srinagar from ₹540/kg. Harvested live to order & delivered chilled in 2 hrs. Free delivery or vending center pickup.",
  openGraph: {
    title: "Fresh Rainbow Trout in Srinagar from ₹540/kg | Urban Trout",
    description:
      "Fresh Rainbow Trout in Srinagar from ₹540/kg. Harvested live to order & delivered chilled in 2 hrs. Free delivery or vending center pickup.",
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
    description: "Farm-fresh Rainbow Trout harvested to order in Srinagar. Chilled 2-hour doorstep delivery within our 5km farm zone.",
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
      "legalName": "Urban Trout Aquaculture",
      "alternateName": ["Urban Trout Srinagar", "Urban Trout Aquaculture", "ٹراؤٹ مچھلی سرینگر", "ट्राउट मछली श्रीनगर"],
      "image": "https://urbantrout.in/images/og-image.png",
      "logo": "https://urbantrout.in/sitelogo.png",
      "description": "Srinagar's premier cold-water aquaculture farm located in Malabagh. Producing fresh whole and cleaned Rainbow Trout (Oncorhynchus mykiss) harvested live to order with rapid chilled delivery within 2 hours within our 5km farm radius.",
      "url": "https://urbantrout.in",
      "hasMap": "https://maps.app.goo.gl/4N8A8ywhJpys9EaDA",
      "sameAs": [
        "https://maps.app.goo.gl/4N8A8ywhJpys9EaDA",
        "https://www.google.com/maps/place/Urban+Trout+Aquaculture/@34.1445563,74.8245018,124m/data=!3m1!1e3!4m12!1m5!3m4!2zMzTCsDA4JzQwLjQiTiA3NMKwNDknMjguMyJF!8m2!3d34.1445563!4d74.8245018!3m5!1s0x38e185002b8cf0f1:0x4e0a6d5162a4d339!8m2!3d34.1445749!4d74.8245233!16s%2Fg%2F11wsm2z4l0"
      ],
      "telephone": "+918491006127",
      "email": "info.urbantrout@gmail.com",
      "founder": {
        "@type": "Person",
        "name": "Skindar Mohd Sideeq"
      },
      "hasCredential": {
        "@type": "EducationalOccupationalCredential",
        "credentialCategory": "Government Food Safety Registration",
        "name": "FSSAI Food Business Registration",
        "recognizedBy": {
          "@type": "GovernmentOrganization",
          "name": "Food Safety and Standards Authority of India (FSSAI), Department of Health & Medical Education, Government of Jammu & Kashmir"
        },
        "identifier": "21026414000392"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "reviewCount": "8",
        "bestRating": "5",
        "worstRating": "1"
      },
      "priceRange": "₹540 - ₹580 per Kg",
      "currenciesAccepted": "INR",
      "paymentAccepted": "Cash on Delivery, UPI, Debit Card, Credit Card, Net Banking",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Malla Bagh Naseem Bagh Hazratbal, Zone-III, Near R P School (Girls Wing)",
        "addressLocality": "Srinagar",
        "addressRegion": "Jammu and Kashmir",
        "postalCode": "190006",
        "addressCountry": "IN"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 34.1445563,
        "longitude": 74.8245018
      },
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Saturday",
            "Sunday"
          ],
          "opens": "07:00",
          "closes": "22:00"
        }
      ],
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
              "sku": "UT-WHOLE-TROUT",
              "mpn": "UT-WHOLE-TROUT",
              "brand": {
                "@type": "Brand",
                "name": "Urban Trout"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "reviewCount": "34",
                "bestRating": "5",
                "worstRating": "1"
              },
              "review": [
                {
                  "@type": "Review",
                  "author": {
                    "@type": "Person",
                    "name": "Tariq A."
                  },
                  "datePublished": "2026-06-15",
                  "reviewBody": "Exceptionally fresh trout harvested directly to order in Srinagar. Perfect texture and delicate clean taste.",
                  "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": "5",
                    "bestRating": "5"
                  }
                }
              ],
              "offers": {
                "@type": "Offer",
                "price": "540",
                "priceCurrency": "INR",
                "availability": "https://schema.org/InStock",
                "validFrom": "2025-01-01",
                "priceValidUntil": "2027-12-31",
                "url": "https://urbantrout.in/shop/whole-trout",
                "itemCondition": "https://schema.org/NewCondition",
                "seller": {
                  "@type": "Organization",
                  "name": "Urban Trout"
                },
                "shippingDetails": {
                  "@type": "OfferShippingDetails",
                  "shippingRate": {
                    "@type": "MonetaryAmount",
                    "value": "0",
                    "currency": "INR"
                  },
                  "shippingDestination": {
                    "@type": "DefinedRegion",
                    "addressCountry": "IN",
                    "addressRegion": "Jammu and Kashmir",
                    "addressLocality": "Srinagar"
                  },
                  "deliveryTime": {
                    "@type": "ShippingDeliveryTime",
                    "handlingTime": {
                      "@type": "QuantitativeValue",
                      "minValue": 0,
                      "maxValue": 0,
                      "unitCode": "DAY"
                    },
                    "transitTime": {
                      "@type": "QuantitativeValue",
                      "minValue": 0,
                      "maxValue": 1,
                      "unitCode": "DAY"
                    }
                  }
                },
                "hasMerchantReturnPolicy": {
                  "@type": "MerchantReturnPolicy",
                  "applicableCountry": "IN",
                  "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
                  "merchantReturnDays": 0
                }
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
              "sku": "UT-GUTTED-TROUT",
              "mpn": "UT-GUTTED-TROUT",
              "brand": {
                "@type": "Brand",
                "name": "Urban Trout"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "reviewCount": "42",
                "bestRating": "5",
                "worstRating": "1"
              },
              "review": [
                {
                  "@type": "Review",
                  "author": {
                    "@type": "Person",
                    "name": "Bilal M."
                  },
                  "datePublished": "2026-07-10",
                  "reviewBody": "100% pan-ready and completely fresh. Scaled and gutted thoroughly, delivered chilled in ice within Srinagar.",
                  "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": "5",
                    "bestRating": "5"
                  }
                }
              ],
              "offers": {
                "@type": "Offer",
                "price": "580",
                "priceCurrency": "INR",
                "availability": "https://schema.org/InStock",
                "validFrom": "2025-01-01",
                "priceValidUntil": "2027-12-31",
                "url": "https://urbantrout.in/shop/gutted-trout",
                "itemCondition": "https://schema.org/NewCondition",
                "seller": {
                  "@type": "Organization",
                  "name": "Urban Trout"
                },
                "shippingDetails": {
                  "@type": "OfferShippingDetails",
                  "shippingRate": {
                    "@type": "MonetaryAmount",
                    "value": "0",
                    "currency": "INR"
                  },
                  "shippingDestination": {
                    "@type": "DefinedRegion",
                    "addressCountry": "IN",
                    "addressRegion": "Jammu and Kashmir",
                    "addressLocality": "Srinagar"
                  },
                  "deliveryTime": {
                    "@type": "ShippingDeliveryTime",
                    "handlingTime": {
                      "@type": "QuantitativeValue",
                      "minValue": 0,
                      "maxValue": 0,
                      "unitCode": "DAY"
                    },
                    "transitTime": {
                      "@type": "QuantitativeValue",
                      "minValue": 0,
                      "maxValue": 1,
                      "unitCode": "DAY"
                    }
                  }
                },
                "hasMerchantReturnPolicy": {
                  "@type": "MerchantReturnPolicy",
                  "applicableCountry": "IN",
                  "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
                  "merchantReturnDays": 0
                }
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
