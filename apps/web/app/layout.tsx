import { GoogleTagManager } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "../modules/ui/globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Opinodo Surveys",
    default: "Opinodo Surveys",
  },
  description: "Open-Source Survey Suite",
};

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} translate="no">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1574672111746393"
          crossOrigin="anonymous"></script>
      </head>
      {process.env.VERCEL === "1" && <SpeedInsights sampleRate={0.1} />}
      <GoogleTagManager gtmId={"GTM-PJ6M9K9P"} />
      <body className="flex h-dvh flex-col transition-all ease-in-out">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
