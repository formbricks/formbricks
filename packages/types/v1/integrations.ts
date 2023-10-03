import { z } from "zod";
import { ZEnvironment } from "./environment";

// Define a specific schema for googleSheets config

export const ZGoogleCredential = z.object({
  scope: z.string(),
  token_type: z.literal("Bearer"),
  expiry_date: z.number(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export const ZGoogleSpreadsheet = z.object({
  name: z.string(),
  id: z.string(),
});

export const ZAirTable = ZGoogleSpreadsheet;

const ZBaseSurveyData = z.object({
  createdAt: z.date(),
  questionIds: z.array(z.string()),
  questions: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});

export const ZGoogleSheetsConfigData = z
  .object({
    spreadsheetId: z.string(),
    spreadsheetName: z.string(),
  })
  .merge(ZBaseSurveyData);

export const ZAirTableConfigData = z
  .object({
    tableId: z.string(),
    baseId: z.string(),
  })
  .merge(ZBaseSurveyData);

const ZGoogleSheetsConfig = z.object({
  key: ZGoogleCredential,
  data: z.array(ZGoogleSheetsConfigData),
  email: z.string(),
});

const ZAirTableConfig = z.object({
  key: z.string(),
  data: z.array(ZAirTableConfigData),
});

// Define a dynamic schema for config based on integration type
const ZPlaceholderConfig = z.object({
  placeholder: z.string(),
});

export const ZIntegrationConfig = z.union([ZGoogleSheetsConfig, ZPlaceholderConfig, ZAirTableConfig]);

const integrationsTypes = z.enum(["googleSheets", "placeholder", "airtable"]);

export const ZIntegration = z.object({
  id: z.string(),
  type: integrationsTypes,
  environmentId: z.string(),
  config: ZIntegrationConfig,
});

export const ZGoogleSheetIntegration = z.object({
  id: z.string(),
  type: integrationsTypes.extract(["googleSheets"]),
  environmentId: z.string(),
  config: ZGoogleSheetsConfig,
});

export const ZPlaceHolderIntegration = z.object({
  id: z.string(),
  type: integrationsTypes.extract(["placeholder"]),
  environmentId: z.string(),
  config: ZPlaceholderConfig,
  environment: ZEnvironment,
});

export const ZAirTableIntegration = z.object({
  id: z.string(),
  type: integrationsTypes.extract(["airtable"]),
  environmentId: z.string(),
  config: ZAirTableConfig,
});

export type TIntegration = z.infer<typeof ZIntegration>;
export type TIntegrationConfig = z.infer<typeof ZIntegrationConfig>;
export type TGoogleCredential = z.infer<typeof ZGoogleCredential>;
export type TGoogleSpreadsheet = z.infer<typeof ZGoogleSpreadsheet>;
export type TGoogleSheetsConfig = z.infer<typeof ZGoogleSheetsConfig>;
export type TGoogleSheetsConfigData = z.infer<typeof ZGoogleSheetsConfigData>;
export type TGoogleSheetIntegration = z.infer<typeof ZGoogleSheetIntegration>;
export type TAirTableIntegration = z.infer<typeof ZAirTableIntegration>;
export type TPlaceHolderIntegration = z.infer<typeof ZPlaceHolderIntegration>;
export type TAirtable = z.infer<typeof ZAirTable>;
export type TZAirTableConfigData = z.infer<typeof ZAirTableConfigData>;
