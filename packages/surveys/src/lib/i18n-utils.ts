import {
  DEFAULT_SURVEY_LANGUAGE_KEY,
  matchSurveyLanguage,
} from "@formbricks/i18n-utils/survey-language-match";
import { TSurveyLanguage } from "@formbricks/types/surveys/types";

/**
 * Resolve the language a survey should render in, for i18next.
 *
 * Returns the survey's own STORED language code (not a canonicalized one) so it always lines up with
 * the survey's i18n content keys. The requested code goes through the shared survey language matcher
 * (`@formbricks/i18n-utils/survey-language-match`) — the same one link surveys and the SDK use — so it
 * resolves regardless of which side is legacy or canonical: a legacy request (`de`) against a
 * migrated survey (`de-DE`), a canonical request (`de-DE`) against a not-yet-migrated / stale-cached
 * survey (`de`), or a bare request (`en`) against `en-US`. A code the matcher cannot place is passed
 * through unchanged, and i18next maps it to a translation bundle via its fallback chain (see
 * i18n.config).
 */
export const getI18nLanguage = (languageCode: string, languages: TSurveyLanguage[]) => {
  const defaultLanguageCode = languages.find((lng) => lng.default)?.language?.code || "en";
  if (languageCode === DEFAULT_SURVEY_LANGUAGE_KEY) return defaultLanguageCode;

  const matchedLanguage = matchSurveyLanguage(languages, languageCode);
  if (matchedLanguage === DEFAULT_SURVEY_LANGUAGE_KEY) return defaultLanguageCode;
  return matchedLanguage ?? languageCode;
};
