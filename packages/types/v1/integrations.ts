import { z } from "zod";

/* COMMON CONFIGURATIONS */
const ZBaseSurveyData = z.object({
  createdAt: z.date(),
  questionIds: z.array(z.string()),
  questions: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});

const integrationsTypes = z.enum(["googleSheets", "airtable"]);

export type TIntegrationTypes = z.infer<typeof integrationsTypes>;

/* GOOGLE SHEETS CONFIGURATIONS */
export const ZGoogleCredential = z.object({
  scope: z.string(),
  token_type: z.literal("Bearer"),
  expiry_date: z.number(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export type TGoogleCredential = z.infer<typeof ZGoogleCredential>;

export const ZGoogleSpreadsheet = z.object({
  name: z.string(),
  id: z.string(),
});
export type TGoogleSpreadsheet = z.infer<typeof ZGoogleSpreadsheet>;

export const ZGoogleSheetsConfigData = z
  .object({
    spreadsheetId: z.string(),
    spreadsheetName: z.string(),
  })
  .merge(ZBaseSurveyData);

export type TGoogleSheetsConfigData = z.infer<typeof ZGoogleSheetsConfigData>;

const ZGoogleSheetsConfig = z.object({
  key: ZGoogleCredential,
  data: z.array(ZGoogleSheetsConfigData),
  email: z.string(),
});

export type TGoogleSheetsConfig = z.infer<typeof ZGoogleSheetsConfig>;

export const ZGoogleSheetIntegration = z.object({
  id: z.string(),
  type: integrationsTypes.extract(["googleSheets"]),
  environmentId: z.string(),
  config: ZGoogleSheetsConfig,
});

export type TGoogleSheetIntegration = z.infer<typeof ZGoogleSheetIntegration>;

export type TGoogleSheetIntegrationInput = Pick<TGoogleSheetIntegration, "type" | "config">;

/* AIRTABLE CONFIGURATIONS */
export const ZAirTable = z.object({
  name: z.string(),
  id: z.string(),
});

export type TAirtable = z.infer<typeof ZAirTable>;

export const ZAirtableCredential = z.object({
  expiry_date: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export type TAirtableCredential = z.infer<typeof ZAirtableCredential>;

export const ZAirTableConfigData = z
  .object({
    tableId: z.string(),
    baseId: z.string(),
    tableName: z.string(),
  })
  .merge(ZBaseSurveyData);

export type TZAirTableConfigData = z.infer<typeof ZAirTableConfigData>;

const ZAirTableConfig = z.object({
  key: ZAirtableCredential,
  data: z.array(ZAirTableConfigData),
  email: z.string(),
});

export const ZAirTableIntegration = z.object({
  id: z.string(),
  type: integrationsTypes.extract(["airtable"]),
  environmentId: z.string(),
  config: ZAirTableConfig,
});

export type TAirTableIntegration = z.infer<typeof ZAirTableIntegration>;

export const ZAirtableTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.coerce.number(),
});

export type TAirtableIntegrationInput = Pick<TAirTableIntegration, "type" | "config">;

/* COMMON CONFIGURATIONS */
export const ZIntegrationConfig = z.union([ZGoogleSheetsConfig, ZAirTableConfig]);
export type TIntegrationConfig = z.infer<typeof ZIntegrationConfig>;

export const ZIntegration = z.object({
  id: z.string(),
  type: integrationsTypes,
  environmentId: z.string(),
  config: ZIntegrationConfig,
});
export type TIntegration = z.infer<typeof ZIntegration>;

export type TIntegrationInput = Pick<TIntegration, "type" | "config">;
