import { z } from "zod";
import { ZGoogleSheetsConfig } from "./lib/googleSheet";
import { ZAirTableConfig } from "./lib/airTable";

export const ZBaseSurveyData = z.object({
  createdAt: z.date(),
  questionIds: z.array(z.string()),
  questions: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});

export const ZIntegrationsTypes = z.enum(["googleSheets", "airtable"]);

export const ZIntegrationConfig = z.union([ZGoogleSheetsConfig, ZAirTableConfig]);

export const ZIntegration = z.object({
  id: z.string(),
  type: ZIntegrationsTypes,
  environmentId: z.string(),
  config: ZIntegrationConfig,
});
