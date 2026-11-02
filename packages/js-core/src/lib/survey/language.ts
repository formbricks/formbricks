import type { TVisitorLanguage } from "@formbricks/creatives";

/**
 * Which language an app survey opens in, and whether the visitor's language skips it (ENG-4003). The
 * full matcher (`resolveSurveyLanguage` in `@formbricks/i18n-utils`) carries the canonical language
 * table, which the SDK leaves to the surveys bundle: `renderWidget` loads that bundle anyway, and an older
 * bundle without the matcher gets exact matching, the SDK's matcher from before it. Creatives decide on
 * the page from languages the server precomputed instead (`matchLanguage` in `@formbricks/creatives`).
 */

/** A language as the matcher reads it. */
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

/** The SDK's matcher from before the shared one (ENG-3289): the exact code, then the alias, ignoring case. */
const matchLanguageExactly = (
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
 * browser language, then the default) with exact matching only: the resolver for a surveys bundle that
 * predates the shared one.
 */
export const resolveLanguageExactly: TLanguageResolver = ({
  languages,
  explicitLanguage,
  browserLanguages = [],
  autoSelectLanguage,
  unmatchedExplicitLanguage,
}) => {
  if (explicitLanguage?.trim()) {
    const match = matchLanguageExactly(languages, explicitLanguage);
    // The SDK never shows an app survey that lacks the language the site set.
    if (match || unmatchedExplicitLanguage === "skip") return match;
  }
  if (autoSelectLanguage) {
    for (const browserLanguage of browserLanguages) {
      const match = matchLanguageExactly(languages, browserLanguage);
      if (match) return match;
    }
  }
  return "default";
};

/** The language an app survey renders in for this visitor, or `null` to skip it. One language needs no matching. */
export const chooseSurveyLanguage = (
  {
    languages = [],
    autoSelectLanguage,
  }: { languages?: readonly TMatchableLanguage[]; autoSelectLanguage?: boolean | null },
  visitor: TVisitorLanguage,
  resolveLanguage: TLanguageResolver
): string | null =>
  languages.length <= 1
    ? "default"
    : resolveLanguage({
        languages,
        explicitLanguage: visitor.explicit,
        browserLanguages: autoSelectLanguage ? visitor.browser : [],
        autoSelectLanguage,
        unmatchedExplicitLanguage: "skip",
      });
