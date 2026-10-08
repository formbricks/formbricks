import { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Keeps "Use browser language by default" in step with the survey's multi-language state across one
 * editor change, from `previous` to `next`:
 *
 * - Multi-language becoming active (the first language — the default — is added) turns it ON: a survey
 *   offered in several languages should open in the respondent's own one unless the creator opts out.
 * - Multi-language being deactivated (every language, and with them all translations, removed) turns
 *   it OFF, so a later re-activation starts from the same ON default instead of a stale value.
 * - Every other change leaves the creator's choice alone.
 */
export const applyAutoSelectLanguageRule = (previous: TSurvey, next: TSurvey): TSurvey => {
  const wasMultiLanguage = previous.languages.length > 0;
  const isMultiLanguage = next.languages.length > 0;

  if (!wasMultiLanguage && isMultiLanguage) return { ...next, autoSelectLanguage: true };
  if (wasMultiLanguage && !isMultiLanguage) return { ...next, autoSelectLanguage: false };
  return next;
};
