import { PHProvider } from "@/modules/ui/components/post-hog-client";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "../modules/ui/globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Formbricks",
    default: "Formbricks",
  },
  description: "Open-Source Survey Suite",
};

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} translate="no">
      {process.env.VERCEL === "1" && <SpeedInsights sampleRate={0.1} />}
      <body className="flex h-dvh flex-col transition-all ease-in-out">
        <PHProvider>
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        </PHProvider>
      </body>
    </html>
  );
};

export default RootLayout;
