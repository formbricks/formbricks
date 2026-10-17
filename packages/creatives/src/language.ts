import type { TLanguageMatch } from "./types";

/**
 * Which language a visitor gets on a creative (ENG-4003, review fix C7), decided on the page with
 * nothing to load: the server precomputes each language list (`TLanguageMatch`) with the full matcher
 * (`resolveSurveyLanguage` in `@formbricks/i18n-utils`), so the SDK only looks the visitor's language up.
 * The same order as that matcher: the language the site set, then the browser's when its survey uses
 * browser language, then the default.
 */

/** What the SDK knows of the visitor's language. */
export interface TVisitorLanguage {
  /** The language the site set with `setLanguage` (or the user's `language` attribute). */
  explicit?: string | null;
  /** The browser's languages, in preference order. */
  browser: readonly string[];
}

/** As many browser languages as the full matcher tries (`MAX_BROWSER_LANGUAGE_CANDIDATES`). */
const MAX_BROWSER_LANGUAGES = 10;

/** `language` or `language-script`, lowercase; Chinese takes its likely script (`zh-TW` is `zh-hant`). */
const toBase = (code: string): string | undefined => {
  try {
    const locale = new Intl.Locale(code);
    const script = locale.script ?? (locale.language === "zh" ? locale.maximize().script : undefined);
    return (script ? `${locale.language}-${script}` : locale.language).toLowerCase();
  } catch {
    return undefined;
  }
};

/** One requested language against a precomputed list: a stored code, `"default"`, or `null`. */
export const matchLanguage = (match: TLanguageMatch, requested: string): string | null => {
  const code = requested.split(";")[0].trim().replaceAll("_", "-").toLowerCase();
  // Looked up as own string values only: a code like `constructor` must not reach Object's prototype.
  const own = (map: Record<string, string>, key: string | undefined) =>
    key && Object.hasOwn(map, key) ? map[key] : null;
  return code ? (own(match.keys, code) ?? own(match.bases, toBase(code))) : null;
};

/**
 * The language of a creative's texts (`"fallback"`) or of its popup survey (`"skip"`: `null` when the SDK
 * would skip that survey) for this visitor. One language (empty maps) is always the one shown; so is the
 * default when the payload predates precomputed languages.
 */
export const chooseLanguage = (
  match: TLanguageMatch | null | undefined,
  autoSelectLanguage: boolean,
  visitor: TVisitorLanguage | undefined,
  unmatched: "fallback" | "skip"
): string | null => {
  if (!match || !visitor || Object.keys(match.keys).length === 0) return "default";
  if (visitor.explicit?.trim()) {
    const explicit = matchLanguage(match, visitor.explicit);
    if (explicit || unmatched === "skip") return explicit;
  }
  if (autoSelectLanguage) {
    for (const browser of visitor.browser.slice(0, MAX_BROWSER_LANGUAGES)) {
      const matched = matchLanguage(match, browser);
      if (matched) return matched;
    }
  }
  return "default";
};
