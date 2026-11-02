import { createInstance } from "i18next";
import ICU from "i18next-icu";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next/initReactI18next";
import { TUserLocale } from "@formbricks/types/user";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getLocale } from "@/lingodotdev/language";

const initI18next = async (lng: string) => {
  const i18nInstance = createInstance();
  await i18nInstance
    .use(ICU)
    .use(initReactI18next)
    .use(resourcesToBackend((language: string) => import(`../locales/${language}.json`)))
    .init({
      lng,
      fallbackLng: DEFAULT_LOCALE,
      interpolation: {
        escapeValue: false,
      },
    });
  return i18nInstance;
};

type TMessages = { [key: string]: string | TMessages };

const isMessageGroup = (value: unknown): value is TMessages =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `messages` on top of `fallback`, so a key missing from a translation falls back to en-US. */
const withFallback = (messages: TMessages, fallback: TMessages): TMessages => {
  const merged: TMessages = { ...fallback };
  for (const [key, value] of Object.entries(messages)) {
    const base = merged[key];
    merged[key] = isMessageGroup(value) && isMessageGroup(base) ? withFallback(value, base) : value;
  }
  return merged;
};

const loadLocaleFile = async (locale: string): Promise<TMessages> =>
  (await import(`../locales/${locale}.json`)).default;

/**
 * The message catalogue the root layout hands to the client `I18nProvider`: one locale, with en-US
 * filled in under it. The client gets a single catalogue and never loads the fallback itself, which
 * would make i18next initialise asynchronously and hold back the first render (ENG-3771).
 */
export const getLocaleMessages = async (locale: TUserLocale): Promise<TMessages> => {
  const messages = await loadLocaleFile(locale);
  if (locale === DEFAULT_LOCALE) return messages;
  return withFallback(messages, await loadLocaleFile(DEFAULT_LOCALE));
};

export async function getTranslate(locale?: TUserLocale) {
  const resolvedLocale = locale ?? (await getLocale());

  const i18nextInstance = await initI18next(resolvedLocale);
  return i18nextInstance.getFixedT(resolvedLocale);
}
