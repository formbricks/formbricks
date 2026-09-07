"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Switches the app's i18n language for a link survey.
 *
 * The i18n instance is initialised once in the root layout from the Accept-Language locale, which is
 * the right default for a respondent who asked for nothing. A link survey knows better: it also knows
 * the language the respondent asked for, so every screen in the flow — the gates as much as the survey
 * — re-points i18n at the locale resolved for it.
 *
 * @param locale The locale to translate in, already resolved by the caller
 */
export const useAppLocale = (locale: string): void => {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language === locale) return;
    i18n.changeLanguage(locale).catch(() => {
      // A locale with no bundle would otherwise leave the UI on the previous language mid-render.
      i18n.changeLanguage("en-US");
    });
  }, [locale, i18n]);
};
