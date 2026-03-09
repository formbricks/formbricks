import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import enTranslations from "../../locales/en.json";

const SUPPORTED_LOCALES = [
  "ar",
  "da",
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
] as const;

i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LOCALES],

    resources: {
      en: { translation: enTranslations },
    },

    interpolation: { escapeValue: false },
  });

let localeBaseUrl = "";

export const setLocaleBaseUrl = (url: string) => {
  localeBaseUrl = url;
};

const pendingLoads: Record<string, Promise<void>> = {};

export const loadLanguage = async (lng: string): Promise<void> => {
  if (lng === "en" || i18n.hasResourceBundle(lng, "translation")) {
    return;
  }

  if (lng in pendingLoads) {
    return pendingLoads[lng];
  }

  if (!localeBaseUrl) {
    return;
  }

  pendingLoads[lng] = (async () => {
    try {
      const response = await fetch(`${localeBaseUrl}/${lng}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const translations = await response.json();
      i18n.addResourceBundle(lng, "translation", translations);
    } catch {
      console.warn(`[formbricks] Failed to load translations for "${lng}". Using English fallback.`);
    } finally {
      delete pendingLoads[lng];
    }
  })();

  return pendingLoads[lng];
};

export default i18n;
