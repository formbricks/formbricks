"use client";

import { type i18n as TI18n, createInstance } from "i18next";
import ICU from "i18next-icu";
import { ReactNode, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { logger } from "@formbricks/logger";

export type TLocaleMessages = Record<string, unknown>;

interface I18nProviderProps {
  children: ReactNode;
  language: string;
  messages: TLocaleMessages;
}

/**
 * Builds an i18next instance that is ready on the first render, on the server and the client alike.
 *
 * The root layout passes the current locale's messages (en-US fallback already merged in on the
 * server), so there is nothing to load: no backend, and `initAsync: false` makes `init` synchronous.
 * The page therefore renders into the server HTML instead of the whole tree waiting for a client-side
 * locale import (ENG-3771). Adding a backend back would make init asynchronous again and suspend
 * every `useTranslation`.
 *
 * An instance per provider rather than the global `i18next` singleton: this module also renders on
 * the server, where a shared instance would leak one request's language into another.
 */
const createI18n = (locale: string, messages: TLocaleMessages): TI18n => {
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

export const I18nProvider = ({ children, language, messages }: I18nProviderProps) => {
  const [state, setState] = useState(() => ({ language, i18n: createI18n(language, messages) }));

  // A language switch re-renders the root layout with the new locale and its messages.
  if (state.language !== language) {
    setState({ language, i18n: createI18n(language, messages) });
  }

  return <I18nextProvider i18n={state.i18n}>{children}</I18nextProvider>;
};
