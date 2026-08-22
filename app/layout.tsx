import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { CartProvider } from "@/context/CartContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  metadataBase: new URL("https://urbantrout.in"),
  title: {
    default: "Urban Trout | Fresh Rainbow Trout in Srinagar",
    template: "%s | Urban Trout",
  },
  description:
    "Fresh, locally farmed Rainbow Trout in Srinagar. Harvested to order and delivered straight from our farm to your kitchen within hours. Zero antibiotics, pure fresh water.",
  keywords: [
    "Urban Trout",
    "Srinagar trout",
    "rainbow trout kashmir",
    "fresh fish delivery srinagar",
    "fresh trout online srinagar",
    "Kashmir trout",
    "trout farm naseem bagh",
    "buy trout online srinagar",
    "best fish kashmir",
  ],
  openGraph: {
    title: "Urban Trout | Fresh Rainbow Trout in Srinagar",
    description: "Freshly harvested rainbow trout delivered directly from our farm in Srinagar to your home.",
    url: "https://urbantrout.in",
    siteName: "Urban Trout",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Urban Trout - Fresh Rainbow Trout Srinagar",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  verification: {
    google: "t_h48-dHHohnXh8_rwiI8IS-Z2eANoRrIuJLO3devGU",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Urban Trout",
  "image": "https://urbantrout.in/images/og-image.png",
  "description": "Fresh, locally farmed Rainbow Trout in Srinagar. Harvested to order and delivered directly to your doorstep.",
  "@id": "https://urbantrout.in",
  "url": "https://urbantrout.in",
  "telephone": "+917006604148",
  "priceRange": "₹₹",
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
    "latitude": 34.144831,
    "longitude": 74.824280
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
  "servesCuisine": "Seafood",
  "areaServed": "Srinagar"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;300;400;500;600;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-[#031018] text-[#dfedf9] antialiased">
        <CartProvider>
          <Toaster 
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#10212c',
                color: '#dfedf9',
                border: '1px solid #3d4a53',
                fontFamily: '"Manrope", sans-serif',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)'
              },
            }}
          />
          <Navbar />
          <CartDrawer />
          {children}
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
