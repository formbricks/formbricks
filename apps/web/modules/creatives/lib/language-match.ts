import { type TLanguageMatch, toLanguageBase, toLanguageKey } from "@formbricks/creatives";
import { LANGUAGE_CANONICAL_MAP, normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import {
  type TMatchableSurveyLanguage,
  matchSurveyLanguage,
} from "@formbricks/i18n-utils/survey-language-match";

/**
 * A creative's (or its popup survey's) languages precomputed for the SDK (the `TLanguageMatch`
 * contract in `@formbricks/creatives`), so the page decides without loading the surveys bundle: every
 * answer comes from the full matcher (`matchSurveyLanguage`), keyed with the SDK's own `toLanguageKey`
 * and `toLanguageBase`, so a code the page looks up normalizes exactly as it was stored.
 * `language-match.test.ts` holds the two to the same answers over a corpus of requests.
 */

/**
 * A tag of `base` that no stored code, alias or canonical spelling can match (`ZZ` is CLDR's unknown
 * region), so the matcher answers it by base language alone: what it answers for every other such tag.
 */
const toBaseProbe = (base: string): string => `${base}-ZZ`;

export const buildLanguageMatch = (languages: readonly TMatchableSurveyLanguage[]): TLanguageMatch => {
  const match: TLanguageMatch = { keys: {}, bases: {} };
  // One language is always the one shown (the SDK never matches, so never skips, against it).
  if (languages.length <= 1) return match;

  const candidates = languages.filter((language) => language.default || language.enabled);
  const canonicalCodes = new Set(candidates.map(({ language }) => normalizeLanguageCode(language.code)));
  // Codes and aliases first, so they win over a canonical spelling that maps elsewhere, as in the matcher.
  const requests = [
    ...candidates.flatMap(({ language }) => [language.code, language.alias ?? ""]),
    ...Object.keys(LANGUAGE_CANONICAL_MAP).filter((code) => canonicalCodes.has(LANGUAGE_CANONICAL_MAP[code])),
  ];
  for (const request of requests) {
    const key = toLanguageKey(request);
    if (!key || Object.hasOwn(match.keys, key)) continue;
    const answer = matchSurveyLanguage(languages, request);
    if (answer) match.keys[key] = answer;
  }

  for (const { language } of candidates) {
    const base = toLanguageBase(language.code);
    if (!base || Object.hasOwn(match.bases, base)) continue;
    const answer = matchSurveyLanguage(languages, toBaseProbe(base));
    if (answer) match.bases[base] = answer;
  }
  return match;
};
