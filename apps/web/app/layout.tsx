import { SpeedInsights } from "@vercel/speed-insights/next";
import { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Opinodo Surveys",
    default: "Opinodo Surveys",
  },
  description: "Open-Source Survey Suite",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" translate="no">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1574672111746393"
          crossOrigin="anonymous"></script>
      </head>
      {process.env.VERCEL === "1" && <SpeedInsights sampleRate={0.1} />}
      <body className="flex h-dvh flex-col transition-all ease-in-out">{children}</body>
    </html>
  );
};

export default RootLayout;
