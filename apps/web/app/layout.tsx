import { Metadata } from "next";
import React from "react";
import { NoScriptWarning } from "@/app/components/NoScriptWarning";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { SentryClientConfigScript } from "@/lib/sentry/SentryClientConfigScript";
import { I18nProvider } from "@/lingodotdev/client";
import { getLocale } from "@/lingodotdev/language";
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

  return (
    <html lang={locale} translate="no">
      <body className="flex h-dvh flex-col transition-all ease-in-out">
        {/* First in the document so instrumentation-client.ts can start Sentry as early as possible. */}
        <SentryClientConfigScript />
        <NoScriptWarning locale={locale} />
        <I18nProvider language={locale} defaultLanguage={DEFAULT_LOCALE}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
};

export default RootLayout;
