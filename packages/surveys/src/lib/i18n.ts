import type { TFunction } from "i18next";
import { TI18nString } from "@formbricks/types/i18n";
import i18n from "./i18n.config";

// Type guard to check if an object is an I18nString
const isI18nObject = (obj: any): obj is TI18nString => {
  return typeof obj === "object" && obj !== null && Object.keys(obj).includes("default");
};

// Matches \r\n, \n, \r, and their HTML entity variants
const ESCAPED_NEWLINES = /\\r\\n|&#13;&#10;|\\n|\\r|&#10;|&#13;/g;

export const unescapeNewlines = (s: string): string => s.replace(ESCAPED_NEWLINES, "\n");

export const getLocalizedValue = (
  value: TI18nString | undefined,
  languageId: string,
  replaceNewLines: boolean = false
): string => {
  if (!value) {
    return "";
  }

  let result = "";

  if (isI18nObject(value)) {
    // An empty (or whitespace-only) localized value means the string was never translated for this
    // language, so fall back to `default`. This is standard i18n behavior and, critically, keeps
    // choice-membership validation correct: a survey whose default language is keyed by its real
    // code (e.g. "en-GB": "") with content still under `default` must resolve to the default label
    // rather than an empty string, otherwise valid responses are rejected (see ENG-2001).
    const localized = value[languageId];
    if (typeof localized === "string" && localized.trim() !== "") {
      result = localized;
    } else {
      result = value.default;
    }

    result = replaceNewLines ? unescapeNewlines(result) : result;
  }

  return result;
};

/**
 * Get translation function from surveys package's i18n instance
 * This ensures translations are always available, even when called from API routes
 */
export const getTranslations = (languageCode: string): TFunction => {
  // "default" is a Formbricks-internal language identifier, not a valid i18next locale.
  // When "default" is passed, use the current i18n language (which was already resolved
  // to a real locale by the I18nProvider or LanguageSwitch). Calling
  // i18n.changeLanguage("default") would cause i18next to fall back to "en", resetting
  // the user's selected language (see issue #7515).
  const resolvedCode = languageCode === "default" ? i18n.language : languageCode;

  // Ensure the language is set (i18n.changeLanguage is synchronous when resources are already loaded)
  if (i18n.language !== resolvedCode) {
    i18n.changeLanguage(resolvedCode);
  }
  return i18n.getFixedT(resolvedCode);
};
