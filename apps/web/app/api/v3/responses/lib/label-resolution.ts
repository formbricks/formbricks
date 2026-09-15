import type { TI18nString } from "@formbricks/types/i18n";

/**
 * Resolving survey labels in the language a response was collected in.
 *
 * Two things make this its own module rather than a pair of inline calls.
 *
 * **The lookup key is not the language code.** A survey's default language is keyed under the literal
 * string `"default"` in every i18n map, while `Response.language` stores the real BCP-47 code. So a
 * response in the survey's default language must be looked up under `"default"`, and looking it up
 * under its own code finds nothing.
 *
 * **The repo has two `getLocalizedValue`s and they disagree**, so which one is used is a correctness
 * question, not a style one:
 *
 * - `packages/surveys/src/lib/i18n.ts` falls back to `value.default` when the requested language is
 *   missing or blank (ENG-2001).
 * - `apps/web/lib/i18n/utils.ts` returns `""` with no fallback.
 *
 * Every label a respondent actually saw was produced by the first, because the renderer uses it. On a
 * partially translated survey the second returns `""` for untranslated elements — which would make
 * every choice value fail to match its option and land in `unresolved[]`. This module therefore
 * reproduces the surveys-package semantics.
 *
 * It is reproduced rather than imported: `@formbricks/surveys` publishes only its preact bundle, and
 * that module pulls in an i18next instance. Neither belongs in an API route.
 */

const isI18nObject = (value: unknown): value is TI18nString =>
  typeof value === "object" && value !== null && "default" in value;

/**
 * The two fields this module reads off a survey language.
 *
 * Structural rather than `TSurveyLanguage`, because the v3 read select projects only the code —
 * pulling the whole Prisma `Language` model (ids, timestamps, workspace) into a page query to
 * satisfy a type would be a real cost for no gain. A full `TSurveyLanguage` still satisfies it, so
 * the display surfaces pass their own rows unchanged.
 */
export interface TV3SurveyLanguageRef {
  default: boolean;
  language: { code: string };
}

/** What a response's language resolves to, for lookups and for disclosure. */
export interface TV3LabelContext {
  /** The key to index i18n maps with — `"default"` for the survey's default language. */
  lookupKey: string;
  /**
   * The public BCP-47 code the labels are in, for `resolution.labelsLanguage`. Never `"default"`,
   * which is an internal key and would be meaningless to a consumer. `null` when the survey declares
   * no languages at all.
   */
  labelsLanguage: string | null;
}

/**
 * Map a response's stored language onto the survey's language set.
 *
 * Matching is case-insensitive because `Response.language` has been canonicalized at the write path
 * for some time but historical rows predate that, and a survey may declare `pt-BR` against a stored
 * `pt-br`. An unrecognised or absent language falls back to the survey's default rather than failing:
 * a response collected before a language was removed still has to serialize.
 *
 * `enabled` is deliberately not consulted. It says whether an author still offers the language for
 * new submissions, which is not a fact about a response already collected — gating on it would
 * re-language every historical response the day a translation is switched off, and would disagree
 * with the display surfaces, which resolve the same labels without checking it.
 */
export const resolveV3LabelContext = (
  languages: readonly TV3SurveyLanguageRef[],
  responseLanguage: string | null
): TV3LabelContext => {
  const defaultCode = languages.find((entry) => entry.default)?.language.code ?? null;

  if (!responseLanguage) {
    return { lookupKey: "default", labelsLanguage: defaultCode };
  }

  const matched = languages.find(
    (entry) => entry.language.code.toLowerCase() === responseLanguage.toLowerCase()
  );

  if (!matched || matched.default) {
    return { lookupKey: "default", labelsLanguage: defaultCode };
  }

  return { lookupKey: matched.language.code, labelsLanguage: matched.language.code };
};

/**
 * One localized survey string, in the semantics the renderer used when the response was collected.
 *
 * Mirrors `packages/surveys/src/lib/i18n.ts` — a blank or missing translation falls back to
 * `default`. Do not "simplify" this to `value[lookupKey] ?? ""`: that is the other implementation,
 * and it silently unmatches every answer on a partially translated survey.
 */
export const localizeSurveyString = (value: TI18nString | undefined, lookupKey: string): string => {
  if (!isI18nObject(value)) {
    return "";
  }

  const localized = value[lookupKey];

  return typeof localized === "string" && localized.trim() !== "" ? localized : (value.default ?? "");
};
