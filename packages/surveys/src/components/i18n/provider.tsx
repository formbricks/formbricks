import { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { I18nextProvider } from "react-i18next";
import i18n from "../../lib/i18n.config";

export const I18nProvider = ({ language, children }: { language: string; children?: ComponentChildren }) => {
  // Set language synchronously on initial render so children get the correct translations immediately.
  // This is safe because all translations are pre-loaded (bundled) in i18n.config.ts.
  if (i18n.language !== language) {
    i18n.changeLanguage(language);
  }

  // Handle language prop changes after initial render
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  // work around for react-i18next not supporting preact
  return <I18nextProvider i18n={i18n}>{children as unknown as React.ReactNode}</I18nextProvider>;
};
