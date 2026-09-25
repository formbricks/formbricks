import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, test } from "vitest";
import enUS from "@/locales/en-US.json";

/**
 * Both i18next instances (`client.tsx`, `server.ts`) format through `i18next-icu`, which replaces
 * i18next's own `{{name}}` interpolator with ICU MessageFormat. ICU rejects `{{name}}` as a malformed
 * argument, and i18next-icu's fallback on a parse error is to return the raw string — so a
 * `t(key, { name })` on such a message renders the literal placeholder (ENG-3154: the API key rows
 * were announced as "View permissions for {{label}}").
 *
 * Parsed with the same options i18next-icu uses (`ignoreTag`, so `<Trans>` tags pass through). Only
 * en-US is checked: it is the hand-written source, and the other locales are generated from it.
 */
const parse = (message: string) => new IntlMessageFormat(message, "en-US", undefined, { ignoreTag: true });

const flatten = (node: unknown, path: string[] = []): Array<[string, string]> => {
  if (typeof node === "string") return [[path.join("."), node]];
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) => flatten(value, [...path, key]));
  }
  return [];
};

describe("en-US messages", () => {
  test("every message is valid ICU MessageFormat", () => {
    const invalid = flatten(enUS).filter(([, message]) => {
      try {
        parse(message);
        return false;
      } catch {
        return true;
      }
    });

    expect(invalid).toEqual([]);
  });

  test("interpolates the API key label into the row's accessible name", () => {
    expect(parse(enUS.workspace.api_keys.view_permissions_for).format({ label: "Production" })).toBe(
      "View permissions for Production"
    );
  });
});
