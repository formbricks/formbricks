"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Switches the app's i18n language for a link survey, and reports when that language is live.
 *
 * The i18n instance is initialised once in the root layout from the Accept-Language locale, which is
 * the right default for a respondent who asked for nothing. A link survey knows better: it also knows
 * the language the respondent asked for, so every screen in the flow — the gates as much as the survey
 * — re-points i18n at the locale resolved for it.
 *
 * Re-pointing it is asynchronous (the locale bundle is fetched), so a caller whose whole surface is
 * translated chrome — a gate screen — holds its first paint on the returned flag rather than painting
 * once in the root locale and again in the resolved one. It starts `true` in the common case where
 * i18n already sits on the requested locale, so nothing waits when the link asked for nothing.
 *
 * Once the first requested locale is live the flag stays `true`: a later switch (the in-survey
 * language picker) re-points i18n without blanking the screen behind it.
 *
 * @param locale The locale to translate in, already resolved by the caller
 * @returns Whether a locale has been applied, so a gate screen can wait for it
 */
export const useAppLocale = (locale: string): boolean => {
  const { i18n } = useTranslation();
  const [isLocaleReady, setIsLocaleReady] = useState(() => i18n.language === locale);

  useEffect(() => {
    if (i18n.language === locale) {
      setIsLocaleReady(true);
      return;
    }

    let isCurrent = true;
    const applyLocale = async () => {
      try {
        await i18n.changeLanguage(locale);
      } catch {
        // A locale with no bundle would otherwise leave the UI on the previous language mid-render.
        await i18n.changeLanguage("en-US").catch(() => undefined);
      } finally {
        // Settled either way: a caller waiting on this must not be left with nothing to paint.
        if (isCurrent) setIsLocaleReady(true);
      }
    };

    void applyLocale();

    return () => {
      isCurrent = false;
    };
  }, [locale, i18n]);

  return isLocaleReady;
};
