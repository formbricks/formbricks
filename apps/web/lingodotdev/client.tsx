"use client";

import i18n from "i18next";
import ICU from "i18next-icu";
import resourcesToBackend from "i18next-resources-to-backend";
import { ReactNode, useEffect, useState } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { logger } from "@formbricks/logger";

let isInit = false;

interface I18nProviderProps {
  children: ReactNode;
  language: string;
  defaultLanguage: string;
}

export const I18nProvider = ({ children, language, defaultLanguage }: I18nProviderProps) => {
  const locale = language || defaultLanguage;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeI18n = async () => {
      if (isInit) {
        if (i18n.language !== locale) {
          await i18n.changeLanguage(locale);
        }
        setIsReady(true);
      } else {
        try {
          await i18n
            .use(ICU)
            .use(initReactI18next)
            .use(
              resourcesToBackend((language: string) => {
                return import(`../locales/${language}.json`);
              })
            )
            .init({
              lng: locale,
              fallbackLng: defaultLanguage,
              interpolation: { escapeValue: false },
            });
          isInit = true;
          setIsReady(true);
        } catch (error) {
          logger.error(error);
          setIsReady(true);
        }
      }
    };

    initializeI18n();
  }, [locale, defaultLanguage]);

  // Don't render children until i18n is ready to prevent race conditions
  if (!isReady) {
    return null;
  }

  return (
    <I18nextProvider data-testid="i18next-provider" i18n={i18n}>
      {children}
    </I18nextProvider>
  );
};
