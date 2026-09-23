import "server-only";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { resolveSurveyLanguageDefaultTag } from "@formbricks/i18n-utils/survey-runtime-languages";
import { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Resolves a `?lang=` value to one of the survey's own language codes, or "default".
 *
 * Kept out of `link/lib/utils.ts` on purpose: the canonical language table this pulls in is large, and
 * `utils.ts` is imported by the link survey's client components — a public, latency-sensitive page.
 * Server callers only.
 *
 * @param langParam The raw `?lang=` value, or a code being fed back in from a client payload
 * @returns The survey's stored language code, or "default" when the value names no enabled language
 */
export function resolveSurveyLanguageCode(langParam: string | undefined, survey: TSurvey): string {
  if (!langParam) return "default";

  // Match the URL `?lang=` value against the survey's languages in strict precedence so selection is
  // deterministic regardless of array order: (1) an exact stored `code`, then (2) a custom `alias`, then
  // (3) canonical equivalence. Code beats alias because an exact code always lines up with the survey's
  // i18n content keys — without this, one row's alias could shadow another row's exact code. The canonical
  // pass lets a shared link with a legacy code (`?lang=pt`) still resolve to a migrated language (`pt-BR`).
  // Returns the survey's stored code so it lines up with its content keys.
  const langParamLower = langParam.toLowerCase();
  const langParamCanonical = normalizeLanguageCode(langParam);
  const selectedLanguage =
    survey.languages.find(
      (surveyLanguage) => surveyLanguage.language.code.toLowerCase() === langParamLower
    ) ??
    survey.languages.find(
      (surveyLanguage) => surveyLanguage.language.alias?.toLowerCase() === langParamLower
    ) ??
    (langParamCanonical
      ? survey.languages.find(
          (surveyLanguage) => normalizeLanguageCode(surveyLanguage.language.code) === langParamCanonical
        )
      : undefined) ??
    findSiblingVariant(langParam, survey);

  if (!selectedLanguage || selectedLanguage?.default || !selectedLanguage?.enabled) {
    return "default";
  }
  return selectedLanguage.language.code;
}

/**
 * The enabled survey language that writes the same language the respondent asked for, when the survey
 * has no row for the requested variant itself: `?lang=zh-Hant-HK` on a survey offering Traditional
 * (`zh-Hant-TW`) and Simplified (`zh-Hans-CN`) serves the Traditional one. A reader of Hong Kong
 * Chinese can read Taiwanese Chinese; the survey's default language — often another language
 * altogether — is the worse answer.
 *
 * Sibling means sharing a language *default tag*, which keeps the script: `zh-Hant-HK` and `zh-Hant-TW`
 * both resolve to `zh-Hant-TW`, so Traditional never borrows Simplified and `pt-PT` can still fall to
 * `pt-BR`. Disabled rows are skipped, and ties are broken on the stored code so the pick does not
 * depend on the order the languages happen to sit in.
 */
function findSiblingVariant(langParam: string, survey: TSurvey) {
  const requestedDefaultTag = resolveSurveyLanguageDefaultTag(langParam);
  if (!requestedDefaultTag) return undefined;

  return survey.languages
    .filter(
      (surveyLanguage) =>
        surveyLanguage.enabled &&
        resolveSurveyLanguageDefaultTag(surveyLanguage.language.code) === requestedDefaultTag
    )
    .sort((a, b) => a.language.code.localeCompare(b.language.code))[0];
}
