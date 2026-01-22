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
    if (typeof value[languageId] === "string") {
      result = value[languageId];
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
  // Ensure the language is set (i18n.changeLanguage is synchronous when resources are already loaded)
  if (i18n.language !== languageCode) {
    i18n.changeLanguage(languageCode);
  }
  return i18n.getFixedT(languageCode);
};
