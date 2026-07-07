import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { TSurveyLanguage } from "@formbricks/types/surveys/types";

/**
 * Resolve the language a survey should render in.
 *
 * Returns the survey's own STORED language code (not a canonicalized one) so it always lines up with
 * the survey's i18n content keys. The requested code is matched against the survey's configured
 * languages by canonical equivalence, so it resolves regardless of which side is legacy or canonical:
 * a legacy request (`de`) against a migrated survey (`de-DE`), a canonical request (`de-DE`) against a
 * not-yet-migrated / stale-cached survey (`de`), or a bare request (`en`) against `en-US`. i18next then
 * maps the returned code to a translation bundle via its fallback chain (see i18n.config).
 */
export const getI18nLanguage = (languageCode: string, languages: TSurveyLanguage[]) => {
  if (languageCode === "default") {
    return languages.find((lng) => lng.default)?.language?.code || "en";
  }

  const requestedCanonical = normalizeLanguageCode(languageCode);
  const matchedLanguage = languages.find((surveyLanguage) => {
    const surveyCode = surveyLanguage.language?.code;
    if (!surveyCode) return false;
    if (surveyCode.toLowerCase() === languageCode.toLowerCase()) return true;
    return Boolean(requestedCanonical) && requestedCanonical === normalizeLanguageCode(surveyCode);
  });

  return matchedLanguage?.language?.code ?? languageCode;
};
