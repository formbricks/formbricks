import { SpeedInsights } from "@vercel/speed-insights/next";
import { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Formbricks",
    default: "Formbricks",
  },
  description: "Open-Source Survey Suite",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen flex-col">{children}</body>
      <SpeedInsights sampleRate={0.1} />
    </html>
  );
}
