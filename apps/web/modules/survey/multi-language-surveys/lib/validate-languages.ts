import { iso639Languages } from "@formbricks/i18n-utils/utils";

/** The translation key of the first problem a languages edit has, as `EditLanguage` toasts it. */
export type TLanguagesValidationError =
  | "workspace.languages.please_select_a_language"
  | "workspace.languages.duplicate_language_or_language_id"
  | "workspace.languages.conflict_between_identifier_and_alias"
  | "workspace.languages.conflict_between_selected_alias_and_another_language";

const hasDuplicates = (values: string[]): boolean => new Set(values).size !== values.length;

/**
 * Checks the rows of a workspace's Languages settings before any of them is saved, and returns the first
 * problem found, or `null` when the rows can be saved.
 */
export const getLanguagesValidationError = (
  languages: ReadonlyArray<{ code: string; alias: string | null }>
): TLanguagesValidationError | null => {
  const languageCodes = languages.map((language) => language.code.toLowerCase().trim());
  const languageAliases = languages
    .filter((language) => language.alias)
    .map((language) => language.alias!.toLowerCase().trim());

  if (languageCodes.includes("")) {
    return "workspace.languages.please_select_a_language";
  }

  // Check for duplicates within the languageCodes and languageAliases
  if (hasDuplicates(languageAliases) || hasDuplicates(languageCodes)) {
    return "workspace.languages.duplicate_language_or_language_id";
  }

  // Check if any alias matches the identifier of any added languages
  if (languageCodes.some((code) => languageAliases.includes(code))) {
    return "workspace.languages.conflict_between_identifier_and_alias";
  }

  // Prevent choosing an alias that clashes with the ISO code of some other
  // language. Without this guard users could create ambiguous language entries
  // (e.g. alias "nl" pointing to a non-Dutch language) which later breaks the
  // dropdowns that rely on ISO identifiers.
  for (const alias of languageAliases) {
    if (iso639Languages.some((language) => language.code === alias && !languageCodes.includes(alias))) {
      return "workspace.languages.conflict_between_selected_alias_and_another_language";
    }
  }

  return null;
};
