import type { TFunction } from "i18next";
import { IntlMessageFormat } from "intl-messageformat";
import { readFileSync } from "node:fs";
import path from "node:path";

const LOCALES_DIR = path.join(__dirname, "../../../../locales");

const readMessages = (locale: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8")) as Record<string, unknown>;

const lookup = (messages: Record<string, unknown>, key: string): string | undefined => {
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
  return typeof value === "string" ? value : undefined;
};

/**
 * The app's real messages for `locale`, formatted as ICU the way `i18next-icu` formats them in the app
 * (falling back to en-US, as the app does). The app's own `getTranslate` can't stand in for this under
 * Vitest: there `i18next-icu` fails to construct `IntlMessageFormat` and returns every message with its
 * placeholders unfilled.
 */
export const createIcuTranslate = (locale: string): TFunction => {
  const messages = readMessages(locale);
  const fallback = locale === "en-US" ? messages : readMessages("en-US");

  return ((key: string, values?: Record<string, unknown>) => {
    const message = lookup(messages, key) ?? lookup(fallback, key);
    if (message === undefined) return key;
    return String(new IntlMessageFormat(message, locale).format(values as Record<string, string>));
  }) as unknown as TFunction;
};
