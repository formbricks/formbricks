import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
// Import translations from surveys (shared translations)
import arTranslations from "../../../surveys/locales/ar.json";
import deTranslations from "../../../surveys/locales/de.json";
import enTranslations from "../../../surveys/locales/en.json";
import esTranslations from "../../../surveys/locales/es.json";
import frTranslations from "../../../surveys/locales/fr.json";
import hiTranslations from "../../../surveys/locales/hi.json";
import itTranslations from "../../../surveys/locales/it.json";
import jaTranslations from "../../../surveys/locales/ja.json";
import nlTranslations from "../../../surveys/locales/nl.json";
import ptTranslations from "../../../surveys/locales/pt.json";
import roTranslations from "../../../surveys/locales/ro.json";
import ruTranslations from "../../../surveys/locales/ru.json";
import uzTranslations from "../../../surveys/locales/uz.json";
import zhHansTranslations from "../../../surveys/locales/zh-Hans.json";

i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "de", "it", "fr", "es", "ar", "pt", "ro", "ja", "ru", "uz", "zh-Hans", "hi", "nl"],

    resources: {
      en: { translation: enTranslations },
      de: { translation: deTranslations },
      it: { translation: itTranslations },
      fr: { translation: frTranslations },
      es: { translation: esTranslations },
      ar: { translation: arTranslations },
      pt: { translation: ptTranslations },
      ro: { translation: roTranslations },
      ja: { translation: jaTranslations },
      nl: { translation: nlTranslations },
      ru: { translation: ruTranslations },
      uz: { translation: uzTranslations },
      "zh-Hans": { translation: zhHansTranslations },
      hi: { translation: hiTranslations },
    },

    interpolation: { escapeValue: false },
  });

export default i18n;
