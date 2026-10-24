import type { Metadata } from "next";
import DeliveryCalculatorClient from "./DeliveryCalculatorClient";

export const metadata: Metadata = {
  title: "Delivery Calculator & Cold-Chain Zone Checker | Urban Trout Srinagar",
  description:
    "Calculate instant delivery fees, cold-chain courier rates, distance from Malabagh Farm Hub, and free doorstep delivery thresholds across Srinagar.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
};

export default function DeliveryCalculatorPage() {
  return <DeliveryCalculatorClient />;
}
