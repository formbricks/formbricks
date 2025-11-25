import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
// Import translations from survey-embed (shared translations)
import arTranslations from "../../../survey-embed/locales/ar.json";
import deTranslations from "../../../survey-embed/locales/de.json";
import enTranslations from "../../../survey-embed/locales/en.json";
import esTranslations from "../../../survey-embed/locales/es.json";
import frTranslations from "../../../survey-embed/locales/fr.json";
import hiTranslations from "../../../survey-embed/locales/hi.json";
import itTranslations from "../../../survey-embed/locales/it.json";
import jaTranslations from "../../../survey-embed/locales/ja.json";
import nlTranslations from "../../../survey-embed/locales/nl.json";
import ptTranslations from "../../../survey-embed/locales/pt.json";
import roTranslations from "../../../survey-embed/locales/ro.json";
import ruTranslations from "../../../survey-embed/locales/ru.json";
import uzTranslations from "../../../survey-embed/locales/uz.json";
import zhHansTranslations from "../../../survey-embed/locales/zh-Hans.json";

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
