"use client";

import i18n from "i18next";
import ICU from "i18next-icu";
import resourcesToBackend from "i18next-resources-to-backend";
import { ReactNode, useEffect } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";

let isInit = false;

interface I18nProviderProps {
  children: ReactNode;
  language: string;
  defaultLanguage: string;
}

export const I18nProvider = ({ children, language, defaultLanguage }: I18nProviderProps) => {
  const locale = language || defaultLanguage;

  useEffect(() => {
    if (!isInit) {
      i18n
        .use(ICU)
        .use(initReactI18next)
        .use(
          resourcesToBackend((language: string) => {
            return import(`../locales/${language}.json`);
          })
        )
        .init({
          fallbackLng: defaultLanguage,
          interpolation: { escapeValue: false },
        });
      isInit = true;
    } else if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, defaultLanguage]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};
