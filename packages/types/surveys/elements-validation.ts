import { z } from "zod";
import type { TI18nString } from "../i18n";
import type { TSurveyLanguage } from "./types";
import { getTextContent } from "./validation";

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

  return invalidLanguageCodes.map((invalidLanguageCode) => {
    if (invalidLanguageCode === "default") {
      return surveyLanguages.find((lang) => lang.default)?.language.code ?? "default";
    }

    return invalidLanguageCode;
  });
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
): z.IssueData | null => {
  // fieldLabel should contain all the keys present in languages
  for (const language of languages) {
    if (
      !language.default &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- could be undefined
      fieldLabel[language.language.code] === undefined
    ) {
      return {
        code: z.ZodIssueCode.custom,
        message: `The ${field} in question ${String(elementIndex + 1)} of block ${String(blockIndex + 1)} is not present for the following languages: ${language.language.code}`,
        path: ["blocks", blockIndex, "elements", elementIndex, field],
      };
    }
  }

  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

  const messagePrefix = skipArticle ? "" : "The ";
  const messageField = ELEMENT_FIELD_TO_LABEL_MAP[field] ? ELEMENT_FIELD_TO_LABEL_MAP[field] : field;
  const messageSuffix = isDefaultOnly ? " is missing" : " is missing for the following languages: ";

  const message = isDefaultOnly
    ? `${messagePrefix}${messageField} in question ${String(elementIndex + 1)} of block ${String(blockIndex + 1)}${messageSuffix}`
    : `${messagePrefix}${messageField} in question ${String(elementIndex + 1)} of block ${String(blockIndex + 1)}${messageSuffix} -fLang- ${invalidLanguageCodes.join()}`;

  if (invalidLanguageCodes.length) {
    return {
      code: z.ZodIssueCode.custom,
      message,
      path: ["blocks", blockIndex, "elements", elementIndex, field],
      params: isDefaultOnly ? undefined : { invalidLanguageCodes },
    };
  }

  return null;
};

export const findLanguageCodesForDuplicateLabels = (
  labels: TI18nString[],
  surveyLanguages: TSurveyLanguage[]
): string[] => {
  const enabledLanguages = surveyLanguages.filter((lang) => lang.enabled);
  const languageCodes = extractLanguageCodes(enabledLanguages);

  const languagesToCheck = languageCodes.length === 0 ? ["default"] : languageCodes;

  const duplicateLabels = new Set<string>();

  for (const language of languagesToCheck) {
    const labelTexts = labels
      .map((label) => label[language])
      .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
      .map((text) => text.trim());
    const uniqueLabels = new Set(labelTexts);

    if (uniqueLabels.size !== labelTexts.length) {
      duplicateLabels.add(language);
    }
  }

  return Array.from(duplicateLabels);
};
