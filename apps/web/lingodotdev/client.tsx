"use client";

import { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "./config";
import { DEFAULT_LANGUAGE } from "./shared";

interface I18nProviderProps {
  children: ReactNode;
  language: string;
}

export const I18nProvider = ({ children, language }: I18nProviderProps) => {
  const locale = language || DEFAULT_LANGUAGE;

  if (i18n.language !== locale) {
    i18n.changeLanguage(locale);
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};
