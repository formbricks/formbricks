"use client";

import { ReactNode, use, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "./create-i18n";
import { loadLocaleMessages } from "./load-locale-messages";

interface I18nProviderProps {
  readonly children: ReactNode;
  readonly language: string;
}

/**
 * Waits for the locale's messages with `use()` instead of rendering nothing until an effect has run.
 * On the server that means the page renders into the HTML; in the browser the server HTML stays on
 * screen while hydration waits for the cached catalogue chunk (ENG-3771).
 */
export const I18nProvider = ({ children, language }: Readonly<I18nProviderProps>) => {
  const messages = use(loadLocaleMessages(language));
  const [state, setState] = useState(() => ({ language, i18n: createI18n(language, messages) }));

  // A language switch re-renders the root layout with the new locale.
  if (state.language !== language) {
    setState({ language, i18n: createI18n(language, messages) });
  }

  return <I18nextProvider i18n={state.i18n}>{children}</I18nextProvider>;
};
