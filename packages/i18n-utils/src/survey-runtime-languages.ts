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

/**
 * The runtime language a code refers to, or `null` when the runtime ships no bundle for it.
 *
 * Matching is case-insensitive, and falls back to the canonical form of the input, so a legacy spelling
 * resolves to the bundle it means: `de` -> `de-DE`, `zh-CN` -> `zh-Hans-CN`. That is what lets one
 * stored setting line up with both legacy and canonical `Language.code` rows (ENG-1067). A deliberate
 * non-default region stays itself and so has no bundle — `de-AT` is not `de-DE`.
 */
export const resolveSurveyRuntimeLanguageCode = (
  code: string | null | undefined
): TSurveyRuntimeLanguageCode | null => {
  if (!code) return null;
  const trimmedCode = code.trim();
  if (!trimmedCode) return null;

  const exactMatch = runtimeLanguageCodesByLowerCase.get(trimmedCode.toLowerCase());
  if (exactMatch) return exactMatch;

  const canonicalCode = normalizeLanguageCode(trimmedCode);
  return canonicalCode ? (runtimeLanguageCodesByLowerCase.get(canonicalCode.toLowerCase()) ?? null) : null;
};
