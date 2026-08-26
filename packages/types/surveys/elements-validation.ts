import { type z } from "zod";
import type { TI18nString } from "../i18n";
import type { TSurveyLanguage } from "./types";
import { findLanguageCodesForDuplicateLabels, getTextContent } from "./validation";

const extractLanguageCodes = (surveyLanguages?: TSurveyLanguage[]): string[] => {
  if (!surveyLanguages) return [];
  return surveyLanguages.map((surveyLanguage) =>
    surveyLanguage.default ? "default" : surveyLanguage.language.code
  );
};

const validateLabelForAllLanguages = (label: TI18nString, surveyLanguages: TSurveyLanguage[]): string[] => {
  const enabledLanguages = surveyLanguages.filter((lang) => lang.enabled);
  const languageCodes = extractLanguageCodes(enabledLanguages);

  const languages = !languageCodes.length ? ["default"] : languageCodes;
  const invalidLanguageCodes = languages.filter((language) => {
    // Check if label exists and is not undefined
    if (!label[language]) return true;

    // Use getTextContent to extract text from HTML or plain text
    const textContent = getTextContent(label[language]);
    return textContent.length === 0;
  });

  return invalidLanguageCodes;
};

// Map for element field names to user-friendly labels
const ELEMENT_FIELD_TO_LABEL_MAP: Record<string, string> = {
  headline: "question",
  subheader: "description",
  placeholder: "placeholder",
  upperLabel: "upper label",
  lowerLabel: "lower label",
  "consent.label": "checkbox label",
  html: "description",
};

export const validateElementLabels = (
  field: string,
  fieldLabel: TI18nString,
  languages: TSurveyLanguage[],
  blockIndex: number,
  elementIndex: number,
  skipArticle = false
): z.core.$ZodRawIssue | null => {
  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  const isDefaultMissing = invalidLanguageCodes.includes("default");

  const messagePrefix = skipArticle ? "" : "The ";
  const messageField = ELEMENT_FIELD_TO_LABEL_MAP[field] ? ELEMENT_FIELD_TO_LABEL_MAP[field] : field;
  const messageSuffix = isDefaultMissing ? " is missing" : " is missing for the following languages: ";

  const message = isDefaultMissing
    ? `${messagePrefix}${messageField} in question ${String(elementIndex + 1)} of block ${String(blockIndex + 1)}${messageSuffix}`
    : `${messagePrefix}${messageField} in question ${String(elementIndex + 1)} of block ${String(blockIndex + 1)}${messageSuffix} -fLang- ${invalidLanguageCodes.join()}`;

  if (isDefaultMissing) {
    return {
      code: "custom",
      input: fieldLabel,
      message,
      path: ["blocks", blockIndex, "elements", elementIndex, field],
    };
  }

  // fieldLabel should contain all the keys present in languages
  for (const language of languages) {
    if (
      !language.default &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- could be undefined
      fieldLabel[language.language.code] === undefined
    ) {
      return {
        code: "custom",
        input: fieldLabel,
        message: `The ${field} in question ${String(elementIndex + 1)} of block ${String(blockIndex + 1)} is not present for the following languages: ${language.language.code}`,
        path: ["blocks", blockIndex, "elements", elementIndex, field],
      };
    }
  }

  if (invalidLanguageCodes.length) {
    return {
      code: "custom",
      input: fieldLabel,
      message,
      path: ["blocks", blockIndex, "elements", elementIndex, field],
      params: { invalidLanguageCodes },
    };
  }

  return null;
};

// Re-export for backwards compatibility
export { findLanguageCodesForDuplicateLabels };
