import "server-only";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { TI18nString } from "@formbricks/types/surveys/types";
import { isI18nObject } from "./utils";

// Helper function to extract a regular string from an i18nString.
const extractStringFromI18n = (i18nString: TI18nString, languageCode: string): string => {
  if (typeof i18nString === "object" && i18nString !== null) {
    return i18nString[languageCode] || "";
  }
  return i18nString;
};

// Assuming I18nString and extraction logic are defined
const reverseTranslateObject = <T extends Record<string, any>>(obj: T, languageCode: string): T => {
  const clonedObj = structuredClone(obj);
  for (let key in clonedObj) {
    const value = clonedObj[key];
    if (isI18nObject(value)) {
      // Now TypeScript knows `value` is I18nString, treat it accordingly
      clonedObj[key] = extractStringFromI18n(value, languageCode) as T[Extract<keyof T, string>];
    } else if (typeof value === "object" && value !== null) {
      // Recursively handle nested objects
      clonedObj[key] = reverseTranslateObject(value, languageCode);
    }
  }
  return clonedObj;
};
