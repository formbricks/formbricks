import { z } from "zod";
import { ZIntegrationAirtableConfig, ZIntegrationAirtableInput } from "./airtable";
import { ZIntegrationGoogleSheetsConfig, ZIntegrationGoogleSheetsInput } from "./googleSheet";

export const ZIntegrationType = z.enum(["googleSheets", "airtable"]);

export const ZIntegrationConfig = z.union([ZIntegrationGoogleSheetsConfig, ZIntegrationAirtableConfig]);

export type TIntegrationConfig = z.infer<typeof ZIntegrationConfig>;

export const ZIntegrationBase = z.object({
  id: z.string(),
  environmentId: z.string(),
});

export const ZIntegration = ZIntegrationBase.extend({
  type: ZIntegrationType,
  config: ZIntegrationConfig,
});

export type TIntegration = z.infer<typeof ZIntegration>;

export const ZIntegrationBaseSurveyData = z.object({
  createdAt: z.date(),
  questionIds: z.array(z.string()),
  questions: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});

export const ZIntegrationInput = z.union([ZIntegrationGoogleSheetsInput, ZIntegrationAirtableInput]);
export type TIntegrationInput = z.infer<typeof ZIntegrationInput>;

export const ZIntegrationItem = z.object({
  name: z.string(),
  id: z.string(),
});
export type TIntegrationItem = z.infer<typeof ZIntegrationItem>;
