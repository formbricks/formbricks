import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import arTranslations from "../../locales/ar.json";
import deTranslations from "../../locales/de.json";
import enTranslations from "../../locales/en.json";
import esTranslations from "../../locales/es.json";
import frTranslations from "../../locales/fr.json";
import hiTranslations from "../../locales/hi.json";
import huTranslations from "../../locales/hu.json";
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
      "ar",
      "de",
      "en",
      "es",
      "fr",
      "hi",
      "hu",
      "it",
      "ja",
      "nl",
      "pt",
      "ro",
      "ru",
      "sv",
      "uz",
      "zh-Hans",
    ],

    resources: {
      ar: { translation: arTranslations },
      de: { translation: deTranslations },
      en: { translation: enTranslations },
      es: { translation: esTranslations },
      fr: { translation: frTranslations },
      hi: { translation: hiTranslations },
      hu: { translation: huTranslations },
      it: { translation: itTranslations },
      ja: { translation: jaTranslations },
      nl: { translation: nlTranslations },
      pt: { translation: ptTranslations },
      ro: { translation: roTranslations },
      ru: { translation: ruTranslations },
      sv: { translation: svTranslations },
      uz: { translation: uzTranslations },
      "zh-Hans": { translation: zhHansTranslations },
    },

    interpolation: { escapeValue: false },
  });

export default i18n;
