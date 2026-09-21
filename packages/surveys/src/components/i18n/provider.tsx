import { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { I18nextProvider } from "react-i18next";
import i18n, { hasLanguageLoaded, loadLanguage } from "../../lib/i18n.config";

export const I18nProvider = ({ language, children }: { language: string; children?: ComponentChildren }) => {
  const isFirstRender = useRef(true);
  // The language i18next has been pointed at on this provider's behalf. Null until that happens, and
  // deliberately not re-read from `i18n.language`: after mount the language switch owns that, and this
  // provider must not argue with it.
  const appliedLanguage = useRef<string | null>(null);

  // First render only, and only when the strings are already in memory: point i18next at the language
  // synchronously so children paint in it rather than in whatever the module was last left in.
  //
  // Guarding on the first render is what keeps the language switch working. This runs on every render
  // otherwise, and once the respondent picks a different language the prop no longer matches
  // `i18n.language` — so an unguarded call here would snap their choice straight back on the very
  // re-render the switch triggers.
  if (isFirstRender.current) {
    isFirstRender.current = false;
    if (hasLanguageLoaded(language) && i18n.language !== language) {
      i18n.changeLanguage(language);
      appliedLanguage.current = language;
    }
  }

  const [isReady, setIsReady] = useState(() => hasLanguageLoaded(language));

  useEffect(() => {
    if (appliedLanguage.current === language) return;

    // Only the first paint is held back; a language the respondent picks is applied by the switch,
    // which loads the strings before it commits, so the survey never blanks mid-flow.
    if (!hasLanguageLoaded(language)) setIsReady(false);

    let cancelled = false;
    void loadLanguage(language).then(() => {
      if (cancelled) return;
      i18n.changeLanguage(language);
      appliedLanguage.current = language;
      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  // Holding the first paint rather than showing English and swapping: the strings arrive in one small
  // fetch alongside the survey's own data, and a flash of the wrong language reads as a bug.
  if (!isReady) return null;

  // work around for react-i18next not supporting preact
  return <I18nextProvider i18n={i18n}>{children as unknown as React.ReactNode}</I18nextProvider>;
};
