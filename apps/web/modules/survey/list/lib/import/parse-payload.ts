import { z } from "zod";
import { TSurveyCreateInput, ZSurveyCreateInput } from "@formbricks/types/surveys/types";
import {
  type TExportedLanguage,
  type TExportedTrigger,
  ZExportedLanguage,
  ZExportedTrigger,
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

export const parseSurveyPayload = (surveyData: unknown): TParsedPayload | TParseError => {
  if (typeof surveyData !== "object" || surveyData === null) {
    return { error: "Invalid survey data: expected an object" };
  }

  const surveyDataCopy = { ...surveyData } as Record<string, unknown>;

  // Validate and extract languages
  const languagesResult = z.array(ZExportedLanguage).safeParse(surveyDataCopy.languages ?? []);
  if (!languagesResult.success) {
    return {
      error: "Invalid languages format",
      details: languagesResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }
  const exportedLanguages = languagesResult.data;

  // Validate and extract triggers
  const triggersResult = z.array(ZExportedTrigger).safeParse(surveyDataCopy.triggers ?? []);
  if (!triggersResult.success) {
    return {
      error: "Invalid triggers format",
      details: triggersResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }
  const triggers = triggersResult.data;

  // Remove these from the copy before validating against ZSurveyCreateInput
  delete surveyDataCopy.languages;
  delete surveyDataCopy.triggers;

  // Validate the main survey structure
  const surveyResult = ZSurveyCreateInput.safeParse(surveyDataCopy);
  if (!surveyResult.success) {
    return {
      error: "Invalid survey format",
      details: surveyResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }

  return {
    surveyInput: surveyResult.data,
    exportedLanguages,
    triggers,
  };
};
