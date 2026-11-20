import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { iso639Languages } from "@formbricks/i18n-utils/utils";

/** The first problem a languages edit has. */
export type TLanguagesValidationError =
  | "missing_language"
  | "duplicate_language_or_alias"
  | "alias_matches_a_code"
  | "alias_matches_another_language";

const hasDuplicates = (values: string[]): boolean => new Set(values).size !== values.length;

/**
 * Checks the rows of a workspace's Languages settings before any of them is saved, and returns the first
 * problem found, or `null` when the rows can be saved.
 */
export const getLanguagesValidationError = (
  languages: ReadonlyArray<{ code: string; alias: string | null }>
): TLanguagesValidationError | null => {
  const languageCodes = languages.map((language) => language.code.toLowerCase().trim());
  // The server stores each code as its canonical tag, so `de` next to `de-DE` is the same language.
  const canonicalCodes = languageCodes.map((code) => normalizeLanguageCode(code)?.toLowerCase() ?? code);
  const languageAliases = languages
    .filter((language) => language.alias)
    .map((language) => language.alias!.toLowerCase().trim());

  if (languageCodes.includes("")) {
    return "missing_language";
  }

  // The same language twice (by canonical code), or the same alias twice
  if (hasDuplicates(languageAliases) || hasDuplicates(canonicalCodes)) {
    return "duplicate_language_or_alias";
  }

  // Check if any alias matches the identifier of any added languages
  if (languageCodes.some((code) => languageAliases.includes(code))) {
    return "alias_matches_a_code";
  }

  // Prevent choosing an alias that clashes with the ISO code of some other
  // language. Without this guard users could create ambiguous language entries
  // (e.g. alias "nl" pointing to a non-Dutch language) which later breaks the
  // dropdowns that rely on ISO identifiers.
  for (const alias of languageAliases) {
    if (iso639Languages.some((language) => language.code === alias && !languageCodes.includes(alias))) {
      return "alias_matches_another_language";
    }
  }

  return null;
};
