import { Metadata } from "next";
import Script from "next/script";
import React from "react";
import { NoScriptWarning } from "@/app/components/NoScriptWarning";
import { DEFAULT_LOCALE, SENTRY_DSN, SENTRY_ENVIRONMENT } from "@/lib/constants";
import { SentryRuntimeConfig } from "@/lib/sentry-runtime-config";
import { I18nProvider } from "@/lingodotdev/client";
import { getLocale } from "@/lingodotdev/language";
import "../modules/ui/globals.css";

// Read at request time (unlike next.config.mjs's `env`, which bakes values in at build time) so
// that self-hosted Docker images — built once, with SENTRY_DSN only ever supplied when the
// container starts — pick up whatever the operator configured. instrumentation-client.ts, which
// can't read server-only env itself, reads this back off `window.__sentryRuntimeConfig`.
const getSentryRuntimeConfigScript = () => {
  const config: SentryRuntimeConfig = { dsn: SENTRY_DSN, environment: SENTRY_ENVIRONMENT };
  const escapedConfig = JSON.stringify(config).replaceAll("<", String.raw`\u003c`);
  return `window.__sentryRuntimeConfig = ${escapedConfig};`;
};

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
        <Script
          id="sentry-runtime-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: getSentryRuntimeConfigScript() }}
        />
        <NoScriptWarning locale={locale} />
        <I18nProvider language={locale} defaultLanguage={DEFAULT_LOCALE}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
};

export default RootLayout;
