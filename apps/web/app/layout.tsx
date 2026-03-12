import { Metadata } from "next";
import React from "react";
import { SentryProvider } from "@/app/sentry/SentryProvider";
import {
  DEFAULT_LOCALE,
  IS_PRODUCTION,
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  SENTRY_RELEASE,
} from "@/lib/constants";
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
        <noscript>
          <div className="flex h-dvh w-full items-center justify-center bg-slate-50">
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-lg">
              <h1 className="mb-4 text-2xl font-bold text-slate-800">JavaScript Required</h1>
              <p className="text-slate-600">
                Formbricks requires JavaScript to function properly. Please enable JavaScript in your browser
                settings to continue.
              </p>
            </div>
          </div>
        </noscript>
        <SentryProvider
          sentryDsn={SENTRY_DSN}
          sentryRelease={SENTRY_RELEASE}
          sentryEnvironment={SENTRY_ENVIRONMENT}
          isEnabled={IS_PRODUCTION}>
          <I18nProvider language={locale} defaultLanguage={DEFAULT_LOCALE}>
            {children}
          </I18nProvider>
        </SentryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
