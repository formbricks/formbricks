import { TSurvey } from "@formbricks/types/surveys/types";

// A language the survey actually offers respondents: the default one, or any other that is enabled. A
// disabled language keeps its translations in the survey but is never shown, so it does not count.
const countOfferedLanguages = (survey: TSurvey): number =>
  survey.languages.filter((surveyLanguage) => surveyLanguage.default || surveyLanguage.enabled).length;

/**
 * Keeps "Use browser language by default" in step with the survey's multi-language state across one
 * editor change, from `previous` to `next`:
 *
 * - Multi-language becoming active (the first language — the default — is added) turns it ON: a survey
 *   offered in several languages should open in the respondent's own one unless the creator opts out.
 * - The survey starting to offer more than one language (default + an enabled other) while the setting
 *   was never chosen (`null`/unset) turns it ON for the same reason. Surveys created in the editor
 *   already start with their default language, so they never pass through the first case. An explicit
 *   `false` is the creator's opt-out and an explicit `true` is already on — both are left alone.
 * - Multi-language being deactivated (every language, and with them all translations, removed) turns
 *   it OFF, so a later re-activation starts from the same ON default instead of a stale value.
 * - Every other change leaves the creator's choice alone.
 */
export const applyAutoSelectLanguageRule = (previous: TSurvey, next: TSurvey): TSurvey => {
  const wasMultiLanguage = previous.languages.length > 0;
  const isMultiLanguage = next.languages.length > 0;

  if (!wasMultiLanguage && isMultiLanguage) return { ...next, autoSelectLanguage: true };
  if (wasMultiLanguage && !isMultiLanguage) return { ...next, autoSelectLanguage: false };

  const startsOfferingSeveral = countOfferedLanguages(previous) <= 1 && countOfferedLanguages(next) >= 2;
  const isUnset = typeof next.autoSelectLanguage !== "boolean";
  if (startsOfferingSeveral && isUnset) return { ...next, autoSelectLanguage: true };
  return next;
};
