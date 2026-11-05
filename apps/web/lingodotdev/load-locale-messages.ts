import type { TLocaleMessages } from "./create-i18n";

const pending = new Map<string, Promise<TLocaleMessages>>();

/**
 * The message catalogue for one locale, as a promise the `I18nProvider` reads with React's `use()`.
 *
 * Loaded by the provider itself rather than passed down from the root layout: a root-layout prop is
 * part of every full-tree RSC payload, so it would be re-sent on each `router.refresh()`. The dynamic
 * import is a content-hashed chunk instead, cached by the browser across loads and fetched once.
 *
 * Memoised per locale so every render reads the same promise — `use()` needs a stable one, and on the
 * server it spares each request a re-import. A failed load is dropped so the next render retries.
 */
export const loadLocaleMessages = (locale: string): Promise<TLocaleMessages> => {
  let messages = pending.get(locale);
  if (!messages) {
    messages = import(`../locales/${locale}.json`).then(
      (module: { default: TLocaleMessages }) => module.default
    );
    messages.catch(() => pending.delete(locale));
    pending.set(locale, messages);
  }
  return messages;
};
