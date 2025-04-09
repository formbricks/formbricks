import { SentryProvider } from "@/app/sentry/SentryProvider";
import { TolgeeNextProvider } from "@/tolgee/client";
import { getTolgee } from "@/tolgee/server";
import { TolgeeStaticData } from "@tolgee/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Metadata } from "next";
import React from "react";
import { SENTRY_DSN } from "@formbricks/lib/constants";
import "../modules/ui/globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | EngageHQ",
    default: "EngageHQ",
  },
  description: "Open-Source Onchain Engagement Suite",
};

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const locale = "en-US";
  const tolgee = await getTolgee();
  // serializable data that are passed to client components
  const staticData = await tolgee.loadRequired();

  return (
    <html lang={"en-US"} translate="no">
      <body className="flex h-dvh flex-col transition-all ease-in-out">
        {process.env.VERCEL === "1" && <SpeedInsights sampleRate={0.1} />}
        <SentryProvider sentryDsn={SENTRY_DSN}>
          <TolgeeNextProvider language={locale} staticData={staticData as unknown as TolgeeStaticData}>
            {children}
          </TolgeeNextProvider>
        </SentryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
