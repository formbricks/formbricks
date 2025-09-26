import i18n from "i18next";
import ICU from "i18next-icu";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LANGUAGE } from "@/lingodotdev/shared";

let isInit = false;

const isServer = globalThis.window === undefined;

if (!isServer && !isInit) {
  i18n
    .use(ICU)
    .use(initReactI18next)
    .use(
      resourcesToBackend((language: string) => {
        return import(`../locales/${language}.json`);
      })
    )
    .init({
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: { escapeValue: false },
    });

  isInit = true;
}

export default i18n;
