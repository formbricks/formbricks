"use client";

import { useEffect, useRef, useState } from "react";
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

  // The effect below applies the locale THIS caller asked for, so it is keyed on that request alone.
  // `i18n` cannot be a dependency: react-i18next hands back a fresh wrapper object on every language
  // change, so an effect keyed on it re-fires on switches this caller never asked for and re-applies
  // its own (by then stale) locale. Two callers alive at once — a PIN gate holding its server-resolved
  // gate locale, and the survey behind it following the in-survey language picker — then overwrite each
  // other's language forever, until React gives up with "Maximum update depth exceeded" and the
  // respondent lands on the app's error boundary (ENG-3160). The instance itself is the singleton the
  // root layout initialised; only its identity churns, so it is kept in a ref instead. Declared above
  // the effect that reads it, so a commit that changes both lands the new instance first.
  const i18nRef = useRef(i18n);
  useEffect(() => {
    i18nRef.current = i18n;
  }, [i18n]);

  const [isLocaleReady, setIsLocaleReady] = useState(() => i18n.language === locale);

  useEffect(() => {
    const i18nInstance = i18nRef.current;

    if (i18nInstance.language === locale) {
      setIsLocaleReady(true);
      return;
    }

    let isCurrent = true;
    const applyLocale = async () => {
      try {
        await i18nInstance.changeLanguage(locale);
      } catch {
        // A locale with no bundle would otherwise leave the UI on the previous language mid-render.
        await i18nInstance.changeLanguage("en-US").catch(() => undefined);
      } finally {
        // Settled either way: a caller waiting on this must not be left with nothing to paint.
        if (isCurrent) setIsLocaleReady(true);
      }
    };

    void applyLocale();

    return () => {
      isCurrent = false;
    };
  }, [locale]);

  return isLocaleReady;
};
