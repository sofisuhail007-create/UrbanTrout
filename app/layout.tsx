import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { CartProvider } from "@/context/CartContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: {
    default: "Urban Trout | Premium Srinagar Aquaculture",
    template: "%s | Urban Trout",
  },
  description:
    "Srinagar's first high-tech aquaculture facility delivering premium, laboratory-grade Rainbow Trout within 4 hours of harvest. Zero antibiotics, 100% traceable.",
  keywords: [
    "Urban Trout",
    "Srinagar aquaculture",
    "rainbow trout",
    "fresh fish delivery",
    "sustainable seafood",
    "Kashmir trout",
    "RAS farming",
    "buy trout online srinagar",
    "best fish kashmir",
    "buy fish online",
  ],
  openGraph: {
    title: "Urban Trout | Premium Srinagar Aquaculture",
    description: "Lab-to-table rainbow trout from Srinagar's precision aquaculture facility.",
    url: "https://urbantrout.in",
    siteName: "Urban Trout",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Urban Trout Premium Aquaculture",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
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
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
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
