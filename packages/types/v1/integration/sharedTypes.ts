import { z } from "zod";
export * from "./sharedTypes";

export const ZIntegrationBase = z.object({
  id: z.string(),
  environmentId: z.string(),
});
export const ZIntegrationType = z.enum(["googleSheets", "airtable"]);

export const ZIntegrationBaseSurveyData = z.object({
  createdAt: z.date(),
  questionIds: z.array(z.string()),
  questions: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});
