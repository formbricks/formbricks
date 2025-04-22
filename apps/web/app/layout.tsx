import { SentryProvider } from "@/app/sentry/SentryProvider";
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { TolgeeNextProvider } from "@/tolgee/client";
import { getLocale } from "@/tolgee/language";
import { getTolgee } from "@/tolgee/server";
import { TolgeeStaticData } from "@tolgee/react";
import { Metadata } from "next";
import React from "react";
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
  const tolgee = await getTolgee();
  // serializable data that are passed to client components
  const staticData = await tolgee.loadRequired();

  return (
    <html lang={locale} translate="no">
      <body className="flex h-dvh flex-col transition-all ease-in-out">
        <SentryProvider sentryDsn={SENTRY_DSN} isEnabled={IS_PRODUCTION}>
          <TolgeeNextProvider language={locale} staticData={staticData as unknown as TolgeeStaticData}>
            {children}
          </TolgeeNextProvider>
        </SentryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
