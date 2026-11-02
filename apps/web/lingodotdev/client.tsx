"use client";

import { ReactNode, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { type TLocaleMessages, createI18n } from "./create-i18n";

interface I18nProviderProps {
  children: ReactNode;
  language: string;
  messages: TLocaleMessages;
}

export const I18nProvider = ({ children, language, messages }: Readonly<I18nProviderProps>) => {
  const [state, setState] = useState(() => ({ language, i18n: createI18n(language, messages) }));

  // A language switch re-renders the root layout with the new locale and its messages.
  if (state.language !== language) {
    setState({ language, i18n: createI18n(language, messages) });
  }

  return <I18nextProvider i18n={state.i18n}>{children}</I18nextProvider>;
};
