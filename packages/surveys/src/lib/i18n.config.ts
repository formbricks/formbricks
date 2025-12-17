import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import arTranslations from "../../locales/ar.json";
import deTranslations from "../../locales/de.json";
import enTranslations from "../../locales/en.json";
import esTranslations from "../../locales/es.json";
import frTranslations from "../../locales/fr.json";
import hiTranslations from "../../locales/hi.json";
import itTranslations from "../../locales/it.json";
import jaTranslations from "../../locales/ja.json";
import nlTranslations from "../../locales/nl.json";
import ptTranslations from "../../locales/pt.json";
import roTranslations from "../../locales/ro.json";
import ruTranslations from "../../locales/ru.json";
import svTranslations from "../../locales/sv.json";
import uzTranslations from "../../locales/uz.json";
import zhHansTranslations from "../../locales/zh-Hans.json";

i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: [
      "en",
      "de",
      "it",
      "fr",
      "es",
      "ar",
      "pt",
      "ro",
      "ja",
      "ru",
      "uz",
      "zh-Hans",
      "hi",
      "nl",
      "sv",
    ],

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
      sv: { translation: svTranslations },
      "zh-Hans": { translation: zhHansTranslations },
      hi: { translation: hiTranslations },
    },

    interpolation: { escapeValue: false },
  });

export default i18n;
