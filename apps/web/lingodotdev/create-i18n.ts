import { type i18n as TI18n, createInstance } from "i18next";
import ICU from "i18next-icu";
import { loadLocaleMessages } from "./load-locale-messages";

export type TLocaleMessages = Record<string, unknown>;

const NAMESPACE = "translation";

/**
 * Builds an i18next instance that is ready on the first render, on the server and the client alike.
 *
 * The provider has already loaded the current locale's messages, so there is nothing left to load and
 * `init` completes synchronously. Only that one locale is loaded — every locale file carries every key
 * (Lingo.dev generates them from en-US). An i18next backend is deliberately absent: with one, `init`
 * turns asynchronous even when the bundle is already there, and every `useTranslation` suspends
 * (ENG-3771).
 *
 * Link surveys still switch language at runtime (`useAppLocale`), so `changeLanguage` loads a missing
 * locale's messages itself before switching. A switch that is overtaken by a later one while its
 * messages load is dropped, so the language last asked for wins rather than the slowest one.
 *
 * An instance per call rather than the global `i18next` singleton: the provider also renders on the
 * server, where a shared instance would leak one request's language into another.
 */
export const createI18n = (locale: string, messages: TLocaleMessages): TI18n => {
  const instance = createInstance();
  instance
    .use(ICU)
    .init({
      lng: locale,
      resources: { [locale]: { [NAMESPACE]: messages } },
      initAsync: false,
      interpolation: { escapeValue: false },
    })
    // Not `@formbricks/logger`: this runs in the provider that wraps every page, and the logger would
    // put pino in every page's first-load JS for this one line.
    .catch((error: unknown) => console.error(error));

  const switchLanguage = instance.changeLanguage.bind(instance);
  let requested: string | undefined;
  instance.changeLanguage = async (language, callback) => {
    requested = language;
    if (language && !instance.hasResourceBundle(language, NAMESPACE)) {
      instance.addResourceBundle(language, NAMESPACE, await loadLocaleMessages(language));
    }
    if (requested !== language) return instance.t;
    return switchLanguage(language, callback);
  };

  return instance;
};
