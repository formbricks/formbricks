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
const toComparableCode = (code: string): string => code.trim().replaceAll("_", "-").toLowerCase();

/** `Intl.Locale` rejects `_`, so the tier-3/4 helpers are fed the hyphenated spelling. */
const toHyphenatedCode = (code: string): string => code.trim().replaceAll("_", "-");

const toMatchResult = (surveyLanguage: TMatchableSurveyLanguage): string =>
  surveyLanguage.default ? DEFAULT_SURVEY_LANGUAGE_KEY : surveyLanguage.language.code;

/**
 * A stored code that is a legacy spelling (`de`, `zh-CN`) of another stored code (`de-DE`,
 * `zh-Hans-CN`) is a duplicate, not a language of its own: the client environment endpoint appends
 * such entries so SDKs that only match exactly keep matching (ENG-1067), but the survey's content is
 * keyed by the canonical code. Resolve a match on a duplicate to its canonical sibling (ENG-3961), so
 * `de` lands on `de-DE` rather than on a key no content lives under. A survey that stores only the
 * legacy code (not yet migrated) has no sibling and keeps its own code.
 */
const preferCanonicalSibling = (
  candidates: readonly TMatchableSurveyLanguage[],
  match: TMatchableSurveyLanguage
): TMatchableSurveyLanguage => {
  const canonicalCode = normalizeLanguageCode(match.language.code);
  if (!canonicalCode) return match;
  const canonicalComparable = toComparableCode(canonicalCode);
  if (toComparableCode(match.language.code) === canonicalComparable) return match;
  return (
    candidates.find(
      (surveyLanguage) => toComparableCode(surveyLanguage.language.code) === canonicalComparable
    ) ?? match
  );
};

/**
 * The regions that read Latin American Spanish (`es-419`) rather than the `es-ES` base default
 * (ENG-3894): Latin America and the Caribbean plus the United States, as CLDR parents them under
 * `es-419`, and the `419` region code itself.
 */
const ES_419_REGIONS: ReadonlySet<string> = new Set([
  "419",
  "AR",
  "BO",
  "BR",
  "BZ",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PE",
  "PR",
  "PY",
  "SV",
  "US",
  "UY",
  "VE",
]);

/** A plain Spanish regional tag (`es-MX`, `es_419`), and nothing more: no script, variant or extension. */
const PLAIN_SPANISH_REGIONAL_TAG = /^es[-_]([a-z]{2}|\d{3})$/i;

/**
 * The region of a plain Spanish regional tag (`es-MX` -> `MX`), or undefined for anything else. A tag
 * with more subtags (`es-MX-u-nu-latn`, `es-Latn-MX`) keeps the base default, so the creatives page,
 * which only keys plain `es-<region>` tags (`getLatinAmericanSpanishRequests`), answers it the same way.
 */
const spanishRegionOf = (code: string): string | undefined =>
  PLAIN_SPANISH_REGIONAL_TAG.exec(code.trim())?.[1].toUpperCase();

/** Whether a stored code is Latin American Spanish (`es-419`, any spelling). */
const isLatinAmericanSpanish = (code: string): boolean => spanishRegionOf(code) === "419";

/**
 * The Latin American Spanish tags (`es-MX`, `es-AR`, …) the matcher sends to a survey's `es-419`
 * language rather than to its base default, or none when the survey has no enabled `es-419`. Lets a
 * precomputed matcher (creatives) key them without restating the rule.
 */
export const getLatinAmericanSpanishRequests = (languages: readonly TMatchableSurveyLanguage[]): string[] =>
  languages.some(
    (surveyLanguage) =>
      (surveyLanguage.enabled || surveyLanguage.default) &&
      isLatinAmericanSpanish(surveyLanguage.language.code)
  )
    ? [...ES_419_REGIONS].map((region) => `es-${region}`)
    : [];

/** A Latin American Spanish request's `es-419` survey language, when the survey has one. */
const findLatinAmericanSpanish = (
  sameBase: readonly TMatchableSurveyLanguage[],
  requestedCode: string
): TMatchableSurveyLanguage | undefined => {
  const requestedRegion = spanishRegionOf(requestedCode);
  if (!requestedRegion || !ES_419_REGIONS.has(requestedRegion)) return undefined;
  return sameBase.find((surveyLanguage) => isLatinAmericanSpanish(surveyLanguage.language.code));
};

/**
 * Tier 4: a survey language that writes the same base language, script preserved. Works in both
 * directions — `ar` finds `ar-SA`, and `ar-SA` finds `ar-EG` — because both sides are reduced to their
 * language default tag (`ar-*` -> `ar-EG`, `zh-TW` -> `zh-Hant-TW`, never `zh-Hans-CN`).
 *
 * Tie-break among several same-base languages: for a Latin American Spanish request, `es-419`
 * (`es-MX` on an `es-ES`/`es-419` survey picks `es-419`); otherwise the one whose stored code IS the
 * base's canonical default tag (`ar-MA` on an `ar-SA`/`ar-EG` survey picks `ar-EG`), else the first in
 * survey order.
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
    findLatinAmericanSpanish(sameBase, requestedCode) ??
    sameBase.find(
      (surveyLanguage) =>
        normalizeLanguageCode(surveyLanguage.language.code)?.toLowerCase() === requestedBaseTag.toLowerCase()
    ) ??
    sameBase[0]
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
 *   4. same base language, script preserved (`en-GB` -> `en-US`, `zh-TW` -> `zh-Hant-TW`), Latin
 *      American Spanish preferring `es-419` (`es-MX` -> `es-419` over `es-ES`)
 *
 * Disabled languages never match. The default language always does: it is the language the survey
 * was authored in, so its `enabled` flag carries no meaning and has never gated it. A match on a legacy
 * duplicate of another stored code resolves to that canonical code (see `preferCanonicalSibling`).
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
  const toResult = (match: TMatchableSurveyLanguage): string =>
    toMatchResult(preferCanonicalSibling(candidates, match));

  const requestedComparable = toComparableCode(requested);
  const exactCodeMatch = candidates.find(
    (surveyLanguage) => toComparableCode(surveyLanguage.language.code) === requestedComparable
  );
  if (exactCodeMatch) return toResult(exactCodeMatch);

  const requestedLowerCase = requested.toLowerCase();
  const aliasMatch = candidates.find(
    (surveyLanguage) => surveyLanguage.language.alias?.trim().toLowerCase() === requestedLowerCase
  );
  if (aliasMatch) return toResult(aliasMatch);

  const requestedCanonical = normalizeLanguageCode(requested);
  if (requestedCanonical) {
    const canonicalMatch = candidates.find(
      (surveyLanguage) => normalizeLanguageCode(surveyLanguage.language.code) === requestedCanonical
    );
    if (canonicalMatch) return toResult(canonicalMatch);
  }

  const sameBaseMatch = findSameBaseLanguage(candidates, requested);
  return sameBaseMatch ? toResult(sameBaseMatch) : null;
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
