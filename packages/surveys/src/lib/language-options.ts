import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { type TSurveyLanguage } from "@formbricks/types/surveys/types";

/**
 * The canonical form of a language code, falling back to the code itself when it has no canonical
 * mapping. A survey's language list carries back-compat legacy aliases ("hi") alongside canonical
 * codes ("hi-IN"), so anything that compares or keys on a code has to normalize both sides first —
 * otherwise the same language reads as two.
 */
export const canonicalizeLanguageCode = (code: string): string => normalizeLanguageCode(code) ?? code;

/** True when two codes name the same language, whichever alias each of them happens to use. */
export const isSameLanguageCode = (code: string, other: string | null | undefined): boolean => {
  if (!other) return false;
  return canonicalizeLanguageCode(code) === canonicalizeLanguageCode(other);
};

/**
 * The enabled survey languages a switcher should offer, deduped by canonical code so a legacy alias
 * does not appear as a second option for a language already in the list. The canonical entry wins
 * regardless of the order the aliases arrive in (an entry is canonical when its code equals its
 * normalized form), so the dropdown always keeps the canonical code in both its state and its label.
 */
export const getVisibleSurveyLanguages = (surveyLanguages: TSurveyLanguage[]): TSurveyLanguage[] => {
  const byCanonical = new Map<string, TSurveyLanguage>();

  for (const surveyLanguage of surveyLanguages) {
    if (!surveyLanguage.enabled) continue;

    const code = surveyLanguage.language.code;
    const canonical = canonicalizeLanguageCode(code);
    const existing = byCanonical.get(canonical);

    if (!existing || code === canonical) {
      byCanonical.set(canonical, surveyLanguage);
    }
  }

  return [...byCanonical.values()];
};
