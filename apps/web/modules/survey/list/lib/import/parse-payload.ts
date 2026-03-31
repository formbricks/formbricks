import { z } from "zod";
import { logger } from "@formbricks/logger";
import { TSurveyCreateInput, ZSurveyCreateInput } from "@formbricks/types/surveys/types";
import {
  SURVEY_EXPORT_VERSION,
  type TExportedLanguage,
  type TExportedTrigger,
  ZExportedLanguage,
  ZExportedTrigger,
  ZSurveyExportPayload,
} from "../export-survey";

export interface TParsedPayload {
  surveyInput: TSurveyCreateInput;
  exportedLanguages: TExportedLanguage[];
  triggers: TExportedTrigger[];
}

export interface TParseError {
  error: string;
  details?: string[];
}

const getZodIssues = (error: z.ZodError): z.ZodIssue[] => {
  const maybeIssues = (error as unknown as { issues?: z.ZodIssue[] }).issues;
  if (Array.isArray(maybeIssues)) {
    return maybeIssues;
  }

  const maybeErrors = (error as unknown as { errors?: z.ZodIssue[] }).errors;
  if (Array.isArray(maybeErrors)) {
    return maybeErrors;
  }

  return [];
};

export const parseSurveyPayload = (surveyData: unknown): TParsedPayload | TParseError => {
  if (typeof surveyData !== "object" || surveyData === null) {
    return { error: "Invalid survey data: expected an object" };
  }

  let actualSurveyData: Record<string, unknown>;

  // Check if this is the new versioned format (with version, exportDate, and data wrapper)
  const versionedFormatCheck = ZSurveyExportPayload.safeParse(surveyData);
  if (versionedFormatCheck.success) {
    // New format: extract the data from the wrapper
    const { version, data } = versionedFormatCheck.data;

    // Validate version (for future compatibility)
    if (version !== SURVEY_EXPORT_VERSION) {
      logger.warn(
        `Import: Survey export version ${version} differs from current version ${SURVEY_EXPORT_VERSION}`
      );
    }

    actualSurveyData = data as Record<string, unknown>;
  } else {
    // Legacy format or pre-versioning format: use data as-is
    actualSurveyData = surveyData as Record<string, unknown>;
  }

  const surveyDataCopy = { ...actualSurveyData } as Record<string, unknown>;

  // Validate and extract languages
  const languagesResult = z.array(ZExportedLanguage).safeParse(surveyDataCopy.languages ?? []);
  if (!languagesResult.success) {
    const issues = getZodIssues(languagesResult.error);
    return {
      error: "Invalid languages format",
      details: issues.map((e) => {
        const path = e.path.length > 0 ? `languages.${e.path.join(".")}` : "languages";
        return `Field "${path}": ${e.message}`;
      }),
    };
  }
  const exportedLanguages = languagesResult.data;

  // Validate and extract triggers
  const triggersResult = z.array(ZExportedTrigger).safeParse(surveyDataCopy.triggers ?? []);
  if (!triggersResult.success) {
    const issues = getZodIssues(triggersResult.error);
    return {
      error: "Invalid triggers format",
      details: issues.map((e) => {
        const path = e.path.length > 0 ? `triggers.${e.path.join(".")}` : "triggers";
        return `Field "${path}": ${e.message}`;
      }),
    };
  }
  const triggers = triggersResult.data;

  // Remove these from the copy before validating against ZSurveyCreateInput
  delete surveyDataCopy.languages;
  delete surveyDataCopy.triggers;

  // Validate the main survey structure
  const surveyResult = ZSurveyCreateInput.safeParse(surveyDataCopy);
  if (!surveyResult.success) {
    const issues = getZodIssues(surveyResult.error);
    return {
      error: "Invalid survey format",
      details: issues.map((e) => {
        const path = e.path.length > 0 ? e.path.join(".") : "root";
        return `Field "${path}": ${e.message}`;
      }),
    };
  }

  return {
    surveyInput: surveyResult.data,
    exportedLanguages,
    triggers,
  };
};
