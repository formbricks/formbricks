import { type i18n as TI18n, createInstance } from "i18next";
import ICU from "i18next-icu";
import { logger } from "@formbricks/logger";

export type TLocaleMessages = Record<string, unknown>;

/**
 * Builds an i18next instance that is ready on the first render, on the server and the client alike.
 *
 * The root layout passes the current locale's messages (en-US fallback already merged in on the
 * server), so there is nothing to load: no backend, and `initAsync: false` makes `init` synchronous.
 * The page therefore renders into the server HTML instead of the whole tree waiting for a client-side
 * locale import (ENG-3771). Adding a backend back would make init asynchronous again and suspend
 * every `useTranslation`.
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
      resources: { [locale]: { translation: messages } },
      initAsync: false,
      interpolation: { escapeValue: false },
    })
    .catch((error: unknown) => logger.error(error));
  return instance;
};
