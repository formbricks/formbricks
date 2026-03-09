import { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { I18nextProvider } from "react-i18next";
import i18n, { loadLanguage } from "../../lib/i18n.config";

export const I18nProvider = ({ language, children }: { language: string; children?: ComponentChildren }) => {
  // If translations are already available (English or previously loaded), set language synchronously
  const alreadyLoaded = language === "en" || i18n.hasResourceBundle(language, "translation");
  if (alreadyLoaded && i18n.language !== language) {
    i18n.changeLanguage(language);
  }

  const [isReady, setIsReady] = useState(alreadyLoaded);

  useEffect(() => {
    if (i18n.hasResourceBundle(language, "translation")) {
      if (i18n.language !== language) {
        i18n.changeLanguage(language);
      }
      setIsReady(true);
      return;
    }

    let cancelled = false;
    setIsReady(false);
    loadLanguage(language).then(() => {
      if (!cancelled) {
        i18n.changeLanguage(language);
        setIsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  if (!isReady) return null;

  // work around for react-i18next not supporting preact
  return <I18nextProvider i18n={i18n}>{children as unknown as React.ReactNode}</I18nextProvider>;
};
