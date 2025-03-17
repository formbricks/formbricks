import { PHProvider } from "@/modules/ui/components/post-hog-client";
import { TolgeeNextProvider } from "@/tolgee/client";
import { getLocale } from "@/tolgee/language";
import { getTolgee } from "@/tolgee/server";
import { TolgeeStaticData } from "@tolgee/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Metadata } from "next";
import "../modules/ui/globals.css";
import SentryProvider from "./components/SentryProvider";

export const metadata: Metadata = {
  title: {
    template: "%s | Formbricks",
    default: "Formbricks",
  },
  description: "Open-Source Survey Suite",
};

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const locale = await getLocale();
  const tolgee = await getTolgee();
  // serializable data that are passed to client components
  const staticData = await tolgee.loadRequired();

  return (
    <html lang={locale} translate="no">
      {process.env.VERCEL === "1" && <SpeedInsights sampleRate={0.1} />}
      <body className="flex h-dvh flex-col transition-all ease-in-out">
        <SentryProvider>
          <PHProvider>
            <TolgeeNextProvider language={locale} staticData={staticData as unknown as TolgeeStaticData}>
              {children}
            </TolgeeNextProvider>
          </PHProvider>
        </SentryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
