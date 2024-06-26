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

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" translate="no">
      {process.env.VERCEL === "1" && <SpeedInsights sampleRate={0.1} />}
      <body className="flex h-dvh flex-col transition-all ease-in-out">{children}</body>
    </html>
  );
};

export default RootLayout;
