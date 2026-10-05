import { normalizeLanguageCode } from "./canonical";
import { resolveSurveyLanguageDefaultTag } from "./survey-runtime-languages";

/**
 * The one place a requested language is matched against a survey's languages (ENG-3289). Link surveys
 * (`?lang=`, Accept-Language), the JS SDK (`setLanguage()`, `navigator.languages`) and the surveys
 * runtime all call into this module, so every channel lands on the same language for the same input.
 *
 * This is deliberately NOT the `/api/v3/surveys?language=` resolver: that one is a strict validator
 * that rejects what it cannot place, while this one degrades gracefully to the survey's default.
 */

/** What `matchSurveyLanguage` returns when the match is the survey's default language. */
export const DEFAULT_SURVEY_LANGUAGE_KEY = "default";

/** The slice of a survey language row the matcher reads — structural, so every channel's type fits. */
export interface TMatchableSurveyLanguage {
  default: boolean;
  enabled: boolean;
  language: {
    code: string;
    alias?: string | null;
  };
}

/** Drops a `;q=` weight (or any other parameter) and surrounding whitespace from a requested code. */
const cleanRequestedCode = (code: string): string => code.split(";")[0].trim();

/** `_` and `-` are the same separator for matching purposes, and casing never matters. */
const toComparableCode = (code: string): string => code.trim().replace(/_/g, "-").toLowerCase();

/** `Intl.Locale` rejects `_`, so the tier-3/4 helpers are fed the hyphenated spelling. */
const toHyphenatedCode = (code: string): string => code.trim().replace(/_/g, "-");

const toMatchResult = (surveyLanguage: TMatchableSurveyLanguage): string =>
  surveyLanguage.default ? DEFAULT_SURVEY_LANGUAGE_KEY : surveyLanguage.language.code;

/**
 * Tier 4: a survey language that writes the same base language, script preserved. Works in both
 * directions — `ar` finds `ar-SA`, and `ar-SA` finds `ar-EG` — because both sides are reduced to their
 * language default tag (`ar-*` -> `ar-EG`, `zh-TW` -> `zh-Hant-TW`, never `zh-Hans-CN`).
 *
 * Tie-break among several same-base languages: the one whose stored code IS the base's canonical
 * default tag (`ar-MA` on an `ar-SA`/`ar-EG` survey picks `ar-EG`), else the first in survey order.
 */
const findSameBaseLanguage = (
  candidates: readonly TMatchableSurveyLanguage[],
  requestedCode: string
): TMatchableSurveyLanguage | undefined => {
  const requestedBaseTag = resolveSurveyLanguageDefaultTag(toHyphenatedCode(requestedCode));
  if (!requestedBaseTag) return undefined;

  const sameBase = candidates.filter(
    (surveyLanguage) =>
      resolveSurveyLanguageDefaultTag(toHyphenatedCode(surveyLanguage.language.code)) === requestedBaseTag
  );

  return (
    sameBase.find(
      (surveyLanguage) =>
        normalizeLanguageCode(surveyLanguage.language.code)?.toLowerCase() === requestedBaseTag.toLowerCase()
    ) ?? sameBase[0]
  );
};

/**
 * Match one requested language code against a survey's languages.
 *
 * Tiers run in strict order and the first tier that yields a candidate wins, so the outcome never
 * depends on the order the languages happen to be stored in:
 *   1. exact stored code, ignoring case and treating `_` as `-` (`DE_de` -> `de-DE`)
 *   2. exact alias, ignoring case
 *   3. canonical equivalence via `normalizeLanguageCode` (`pt` -> `pt-BR`, `zh-CN` -> `zh-Hans-CN`)
 *   4. same base language, script preserved (`en-GB` -> `en-US`, `zh-TW` -> `zh-Hant-TW`)
 *
 * Disabled languages never match. The default language always does: it is the language the survey
 * was authored in, so its `enabled` flag carries no meaning and has never gated it.
 *
 * @returns The survey's STORED code (so it lines up with the survey's content keys),
 *   `DEFAULT_SURVEY_LANGUAGE_KEY` when the match is the default language, or `null` for no match.
 */
export const matchSurveyLanguage = (
  languages: readonly TMatchableSurveyLanguage[],
  requestedCode: string | null | undefined
): string | null => {
  if (!requestedCode) return null;
  const requested = cleanRequestedCode(requestedCode);
  if (!requested) return null;

  const candidates = languages.filter((surveyLanguage) => surveyLanguage.enabled || surveyLanguage.default);
  if (candidates.length === 0) return null;

  const requestedComparable = toComparableCode(requested);
  const exactCodeMatch = candidates.find(
    (surveyLanguage) => toComparableCode(surveyLanguage.language.code) === requestedComparable
  );
  if (exactCodeMatch) return toMatchResult(exactCodeMatch);

  const requestedLowerCase = requested.toLowerCase();
  const aliasMatch = candidates.find(
    (surveyLanguage) => surveyLanguage.language.alias?.trim().toLowerCase() === requestedLowerCase
  );
  if (aliasMatch) return toMatchResult(aliasMatch);

  const requestedCanonical = normalizeLanguageCode(requested);
  if (requestedCanonical) {
    const canonicalMatch = candidates.find(
      (surveyLanguage) => normalizeLanguageCode(surveyLanguage.language.code) === requestedCanonical
    );
    if (canonicalMatch) return toMatchResult(canonicalMatch);
  }

  const sameBaseMatch = findSameBaseLanguage(candidates, requested);
  return sameBaseMatch ? toMatchResult(sameBaseMatch) : null;
};

/** Upper bound on browser languages tried, so a hostile header or navigator list costs bounded work. */
export const MAX_BROWSER_LANGUAGE_CANDIDATES = 10;

export interface TResolveSurveyLanguageInput {
  languages: readonly TMatchableSurveyLanguage[];
  /** `?lang=` on a link survey, `setLanguage()` / the user's language in the SDK. */
  explicitLanguage?: string | null;
  /** The respondent's languages in preference order (Accept-Language q-order, `navigator.languages`). */
  browserLanguages?: readonly string[];
  /** The survey's "Use browser language by default" setting; null/undefined read as off. */
  autoSelectLanguage?: boolean | null;
  /**
   * What an explicit language that matches nothing does: `"fallback"` continues to the browser
   * languages and then the default (link surveys); `"skip"` returns `null` so the caller does not show
   * the survey at all (SDK).
   */
  unmatchedExplicitLanguage: "fallback" | "skip";
}

/**
 * Resolve the language a survey renders in, for every channel.
 *
 * Precedence:
 *   1. The explicit language, when it matches an enabled survey language. Someone chose it on purpose
 *      — a link that carries `?lang=`, an app that called `setLanguage()` — so it beats any guess.
 *   2. The browser languages, only when the survey turned on "Use browser language by default". They
 *      are tried in preference order and each runs the FULL matcher before the next is tried (D5): with
 *      `en-GB, de-DE` on a `de-DE`/`en-US` survey the respondent's first choice is English, and a
 *      looser English match beats an exact match on their second choice.
 *   3. The survey's default language.
 *
 * The one exception is the SDK (`unmatchedExplicitLanguage: "skip"`): an explicit language that matches
 * nothing returns `null` and the survey is skipped, which is how app surveys have always behaved — an
 * app that set a user's language to French should not show that user a German survey. Browser
 * languages therefore only ever apply in the SDK when no explicit language was set. A link survey has
 * no such contract, so there an unmatched `?lang=` (a typo, a language removed later) falls through
 * to the browser languages and then the default rather than failing the respondent.
 *
 * @returns A stored survey language code, `DEFAULT_SURVEY_LANGUAGE_KEY`, or `null` (skip mode only).
 */
export const resolveSurveyLanguage = ({
  languages,
  explicitLanguage,
  browserLanguages = [],
  autoSelectLanguage,
  unmatchedExplicitLanguage,
}: TResolveSurveyLanguageInput): string | null => {
  if (explicitLanguage?.trim()) {
    const explicitMatch = matchSurveyLanguage(languages, explicitLanguage);
    if (explicitMatch) return explicitMatch;
    if (unmatchedExplicitLanguage === "skip") return null;
  }

  if (autoSelectLanguage) {
    for (const browserLanguage of browserLanguages.slice(0, MAX_BROWSER_LANGUAGE_CANDIDATES)) {
      const browserMatch = matchSurveyLanguage(languages, browserLanguage);
      if (browserMatch) return browserMatch;
    }
  }

  return DEFAULT_SURVEY_LANGUAGE_KEY;
};
