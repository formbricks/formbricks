import "server-only";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
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
      : undefined);

  if (!selectedLanguage || selectedLanguage?.default || !selectedLanguage?.enabled) {
    return "default";
  }
  return selectedLanguage.language.code;
}
