"use client";

import { ReactNode, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "./config";

interface I18nProviderProps {
  children: ReactNode;
  language: string;
  defaultLocale: string;
}

export const I18nProvider = ({ children, language, defaultLocale }: I18nProviderProps) => {
  const locale = language || defaultLocale;

  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};
