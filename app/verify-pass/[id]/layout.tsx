import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Farm Visit Pass | Urban Trout Srinagar",
  description: "Live security and timing verification for Urban Trout Farm official entry passes.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyPassLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
