import { TI18nString } from "@formbricks/types/surveys";

export const getLocalizedValue = (value: string | TI18nString | undefined, language: string): string => {
  if (!value) {
    return "";
  }
  if (isI18nString(value)) {
    return value[language]; // Fall back to 'en' if the specified language is not found
  }
  return value; // If it's a string, return it as-is
};

function isI18nString(object: any): object is TI18nString {
  return typeof object === "object" && object !== null && "_i18n_" in object;
}
