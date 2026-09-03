import { normalizeLanguageCode } from "./canonical";

/**
 * The languages the survey runtime ships hardcoded strings for.
 *
 * These are the canonical BCP-47 tags of the bundles in `packages/surveys/locales/`, and they are the
 * only languages a survey's *default* language can usefully be set to: everything the respondent sees
 * that the creator did not author — buttons, validation messages, the progress label — is resolved from
 * one of these bundles (`packages/surveys/src/lib/i18n.config.ts`), falling back to
 * `DEFAULT_SURVEY_LANGUAGE_CODE` for anything else. Picking a language outside this list would leave
 * those strings in English while the authored content is in the chosen language (ENG-2325).
 *
 * This is a deliberately different (and larger) set from `ZUserLocale`, the ~15 languages the *dashboard*
 * is translated into: a workspace can run surveys in Italian without the app being available in Italian.
 *
 * `packages/surveys/src/lib/i18n.config.test.ts` fails if this list drifts from the shipped bundles.
 */
export const SURVEY_RUNTIME_LANGUAGE_CODES = [
  "ar-EG",
  "da-DK",
  "de-DE",
  "en-US",
  "es-ES",
  "et-EE",
  "fr-FR",
  "hi-IN",
  "hu-HU",
  "id-ID",
  "it-IT",
  "ja-JP",
  "nl-NL",
  "pt-BR",
  "ro-RO",
  "ru-RU",
  "sv-SE",
  "tr-TR",
  "ur-PK",
  "uz-UZ",
  "vi-VN",
  "zh-Hans-CN",
  "zh-Hant-TW",
] as const;

export type TSurveyRuntimeLanguageCode = (typeof SURVEY_RUNTIME_LANGUAGE_CODES)[number];

/** The language every unresolvable survey string falls back to — the runtime's `fallbackLng`. */
export const DEFAULT_SURVEY_LANGUAGE_CODE = "en-US" satisfies TSurveyRuntimeLanguageCode;

const runtimeLanguageCodesByLowerCase = new Map<string, TSurveyRuntimeLanguageCode>(
  SURVEY_RUNTIME_LANGUAGE_CODES.map((code) => [code.toLowerCase(), code])
);

/** The script subtag of a BCP-47 tag, or undefined when it has none (or can't be parsed). */
const scriptOf = (code: string | null): string | undefined => {
  if (!code) return undefined;
  try {
    return new Intl.Locale(code).script;
  } catch {
    return undefined;
  }
};

/**
 * The canonical tag of the language a code belongs to, region dropped: `de-AT` -> `de-DE`, `pt-PT` ->
 * `pt-BR`, `en-GB` -> `en-US`, `ar-SA` -> `ar-EG`. SCRIPT is preserved, so `zh-Hant`/`zh-TW` resolve to
 * Traditional (`zh-Hant-TW`) and never borrow the Simplified tag.
 *
 * A legacy tag can carry its script only in the region (`zh-TW`, `zh-HK`), and `Intl.Locale` does not
 * infer the script, so it is recovered from the tag's canonical form before the region is dropped —
 * otherwise `zh-TW` would strip to a bare `zh` and pick up Simplified.
 */
export const resolveSurveyLanguageDefaultTag = (code: string): string | null => {
  if (!code) return null;
  try {
    const locale = new Intl.Locale(code);
    const canonicalScript = locale.script ?? scriptOf(normalizeLanguageCode(code));
    return normalizeLanguageCode([locale.language, canonicalScript].filter(Boolean).join("-"));
  } catch {
    return null;
  }
};

/**
 * The bundle the survey runtime would serve a given language from, or `null` when it ships none.
 *
 * Three ways to hit a bundle, in order: the code is one; its canonical form is one (`de` -> `de-DE`,
 * `zh-CN` -> `zh-Hans-CN`, which is what lets one stored setting line up with both legacy and canonical
 * `Language.code` rows, ENG-1067); or its language's default tag is one, which is how the runtime serves
 * a regional variant it has no bundle of its own for (`de-AT` renders the `de-DE` strings, `es-MX` the
 * `es-ES` ones).
 *
 * Deliberately NOT the runtime's final English fallback: every tag would resolve through that, and the
 * point of this function is to tell a language whose strings we ship from one that would render English
 * buttons around translated questions (ENG-2325).
 */
export const resolveSurveyRuntimeBundle = (
  code: string | null | undefined
): TSurveyRuntimeLanguageCode | null => {
  if (!code) return null;
  const trimmedCode = code.trim();
  if (!trimmedCode) return null;

  const exactMatch = runtimeLanguageCodesByLowerCase.get(trimmedCode.toLowerCase());
  if (exactMatch) return exactMatch;

  const canonicalCode = normalizeLanguageCode(trimmedCode);
  const canonicalMatch = canonicalCode
    ? runtimeLanguageCodesByLowerCase.get(canonicalCode.toLowerCase())
    : undefined;
  if (canonicalMatch) return canonicalMatch;

  const languageDefaultTag = resolveSurveyLanguageDefaultTag(trimmedCode);
  return languageDefaultTag
    ? (runtimeLanguageCodesByLowerCase.get(languageDefaultTag.toLowerCase()) ?? null)
    : null;
};

/** Whether the survey runtime has strings for this language — see `resolveSurveyRuntimeBundle`. */
export const isSurveyRuntimeLanguage = (code: string | null | undefined): boolean =>
  resolveSurveyRuntimeBundle(code) !== null;
