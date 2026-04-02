import { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { I18nextProvider } from "react-i18next";
import i18n from "../../lib/i18n.config";

export const I18nProvider = ({ language, children }: { language: string; children?: ComponentChildren }) => {
  const isFirstRender = useRef(true);
  const prevLanguage = useRef(language);

  // Set language synchronously on initial render so children get the correct translations immediately.
  // This is safe because all translations are pre-loaded (bundled) in i18n.config.ts.
  // On subsequent renders, skip this to avoid overriding language changes made by the user via LanguageSwitch.
  if (isFirstRender.current) {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
    isFirstRender.current = false;
  }

  // Only update language when the prop itself changes, not when i18n was changed internally by user action
  useEffect(() => {
    if (prevLanguage.current !== language) {
      i18n.changeLanguage(language);
      prevLanguage.current = language;
    }
  }, [language]);

  // work around for react-i18next not supporting preact
  return <I18nextProvider i18n={i18n}>{children as unknown as React.ReactNode}</I18nextProvider>;
};
