import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import deTranslations from "../../../locales/de.json";
import enTranslations from "../../../locales/en.json";

i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "de"],

    resources: {
      en: { translation: enTranslations },
      de: { translation: deTranslations },
    },

    interpolation: { escapeValue: false },
  });

export default i18n;
