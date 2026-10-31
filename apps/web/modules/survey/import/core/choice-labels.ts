import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { findLanguageCodesForDuplicateLabels } from "@formbricks/types/surveys/validation";
import type { TDraftChoice } from "./draft";

/** Disambiguate labels that repeat within a language: `N/A`, `N/A (2)`. Returns whether any changed. */
export function disambiguateLabels(
  items: TDraftChoice[],
  languageCodes: string[],
  surveyLanguages: TSurveyLanguage[]
): boolean {
  // The survey service's own duplicate check, on the internal shape it reads.
  const [defaultCode] = languageCodes;
  const internal = items.map((item) =>
    Object.fromEntries(
      languageCodes.map((code) => [code === defaultCode ? "default" : code, item.label[code] ?? ""])
    )
  );
  const duplicated = findLanguageCodesForDuplicateLabels(internal, surveyLanguages);
  if (duplicated.length === 0) return false;

  for (const flagged of duplicated) {
    const code = flagged === "default" ? defaultCode : flagged;
    // Every label the language already has, so a number added never lands on one of them: `N/A`,
    // `N/A`, `N/A (2)` becomes `N/A`, `N/A (3)`, `N/A (2)`.
    const taken = new Set(items.map((item) => (item.label[code] ?? "").trim()));
    const seen = new Set<string>();
    // Per label, the number to try next, so repeats of one label resume where the last one stopped. A
    // step past a number only skips a label in `taken` (the items' own labels and the renames), so the
    // steps of every search together stay under twice the items: it ends, and in linear time.
    const nextNumber = new Map<string, number>();
    for (const item of items) {
      const text = (item.label[code] ?? "").trim();
      // An empty label is a missing translation, not a repeat: numbered, " (2)" would read as content.
      if (!text) continue;
      if (!seen.has(text)) {
        seen.add(text);
        continue;
      }
      let counter = nextNumber.get(text) ?? 2;
      while (taken.has(`${text} (${counter})`)) counter += 1;
      nextNumber.set(text, counter + 1);
      const renamed = `${text} (${counter})`;
      item.label[code] = renamed;
      taken.add(renamed);
      seen.add(renamed);
    }
  }
  return true;
}
