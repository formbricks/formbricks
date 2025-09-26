import { createInstance } from "i18next";
import ICU from "i18next-icu";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next/initReactI18next";
import { getLocale } from "@/lingodotdev/language";
import { DEFAULT_LANGUAGE } from "@/lingodotdev/shared";

const initI18next = async (lng: string) => {
  const i18nInstance = createInstance();
  await i18nInstance
    .use(ICU)
    .use(initReactI18next)
    .use(resourcesToBackend((language: string) => import(`../locales/${language}.json`)))
    .init({
      lng,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: {
        escapeValue: false,
      },
    });
  return i18nInstance;
};

export async function getTranslate() {
  const locale = await getLocale();

  const i18nextInstance = await initI18next(locale);
  return i18nextInstance.getFixedT(locale);
}
