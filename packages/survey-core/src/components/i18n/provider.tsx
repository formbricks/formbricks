import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../lib/i18n.config";

interface I18nProviderProps {
  language?: string;
  children: React.ReactNode;
}

export const I18nProvider = ({ language = "en", children }: I18nProviderProps) => {
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};
