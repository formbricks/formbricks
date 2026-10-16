/**
 * Which language a visitor gets (ENG-4003): the one rule the SDK applies to an app survey (is it shown,
 * and in which language) and to a creative's texts. The full matcher (`resolveSurveyLanguage` in
 * `@formbricks/i18n-utils`) carries the canonical language table, which the SDK leaves to the surveys
 * bundle; until that bundle is loaded, languages are matched exactly, the SDK's matcher from before it.
 */

/** A language as the matcher reads it: survey languages and creative languages both fit. */
export interface TMatchableLanguage {
  default: boolean;
  enabled: boolean;
  language: { code: string; alias?: string | null };
}

/**
 * The full matcher's input, hand-mirrored from `resolveSurveyLanguage` in `@formbricks/i18n-utils` (as
 * js-core's `vite-env.d.ts` does for the surveys bundle global): keep the two identical.
 */
export interface TLanguageResolverInput {
  languages: readonly TMatchableLanguage[];
  explicitLanguage?: string | null;
  browserLanguages?: readonly string[];
  autoSelectLanguage?: boolean | null;
  unmatchedExplicitLanguage: "fallback" | "skip";
}

/** Returns a stored code, `"default"`, or `null` to skip (only with `unmatchedExplicitLanguage: "skip"`). */
export type TLanguageResolver = (input: TLanguageResolverInput) => string | null;

/** What the SDK knows of the visitor's language. */
export interface TVisitorLanguage {
  /** The language the site set with `setLanguage` (or the user's `language` attribute). */
  explicit?: string | null;
  /** The browser's languages, in preference order. */
  browser: readonly string[];
}

export interface TLanguageChoice {
  /** A stored code, `"default"`, or `null`: skip. */
  language: string | null;
  /** `false` when the full matcher's looser tiers (canonical code, same base language) could choose otherwise. */
  settled: boolean;
}

/** The SDK's matcher from before the shared one (ENG-3289): the exact code, then the alias, ignoring case. */
export const matchLanguageExactly = (
  languages: readonly TMatchableLanguage[],
  requested: string | null | undefined
): string | null => {
  const wanted = requested?.trim().toLowerCase();
  if (!wanted) return null;
  // A disabled language (other than the default) never matches, so its alias can't shadow an enabled code.
  const candidates = languages.filter((language) => language.default || language.enabled);
  const match =
    candidates.find(({ language }) => language.code.toLowerCase() === wanted) ??
    candidates.find(({ language }) => language.alias?.toLowerCase() === wanted);
  if (!match) return null;
  return match.default ? "default" : match.language.code;
};

/**
 * `resolveSurveyLanguage`'s order (the language the site set, then the browser's when the survey uses
 * browser language, then the default) with exact matching only. Only a match on the first language tried
 * is certain: the full matcher runs every tier on one language before it tries the next.
 */
export const resolveLanguageExactly = ({
  languages,
  explicitLanguage,
  browserLanguages = [],
  autoSelectLanguage,
  unmatchedExplicitLanguage,
}: TLanguageResolverInput): TLanguageChoice => {
  let settled = true;
  if (explicitLanguage?.trim()) {
    const match = matchLanguageExactly(languages, explicitLanguage);
    if (match) return { language: match, settled };
    settled = false;
    // The SDK never shows an app survey that lacks the language the site set.
    if (unmatchedExplicitLanguage === "skip") return { language: null, settled };
  }
  if (autoSelectLanguage) {
    for (let index = 0; index < browserLanguages.length; index++) {
      const match = matchLanguageExactly(languages, browserLanguages[index]);
      if (match) return { language: match, settled: settled && index === 0 };
    }
    settled &&= browserLanguages.length === 0;
  }
  return { language: "default", settled };
};

/**
 * The language of an app survey (`"skip"`: `null` when the SDK skips it) or of a creative's texts
 * (`"fallback"`), for this visitor. One language needs no matching. `resolveLanguage` is the full
 * matcher when it is loaded; without it the choice is exact and may not be settled.
 */
export const chooseLanguage = (
  item: { languages?: readonly TMatchableLanguage[]; autoSelectLanguage?: boolean | null },
  visitor: TVisitorLanguage | undefined,
  unmatchedExplicitLanguage: "fallback" | "skip",
  resolveLanguage?: TLanguageResolver
): TLanguageChoice => {
  const { languages = [], autoSelectLanguage } = item;
  if (languages.length <= 1 || !visitor) return { language: "default", settled: true };
  const input: TLanguageResolverInput = {
    languages,
    explicitLanguage: visitor.explicit,
    browserLanguages: autoSelectLanguage ? visitor.browser : [],
    autoSelectLanguage,
    unmatchedExplicitLanguage,
  };
  return resolveLanguage
    ? { language: resolveLanguage(input), settled: true }
    : resolveLanguageExactly(input);
};
