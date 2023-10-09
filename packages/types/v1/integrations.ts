import { z } from "zod";

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

export const ZGoogleSheetsConfigData = z.object({
  createdAt: z.date(),
  questionIds: z.array(z.string()),
  questions: z.string(),
  spreadsheetId: z.string(),
  spreadsheetName: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});
export type TGoogleSheetsConfigData = z.infer<typeof ZGoogleSheetsConfigData>;

const ZGoogleSheetsConfig = z.object({
  key: ZGoogleCredential,
  data: z.array(ZGoogleSheetsConfigData),
  email: z.string(),
});
export type TGoogleSheetsConfig = z.infer<typeof ZGoogleSheetsConfig>;

export const ZGoogleSheetIntegration = z.object({
  id: z.string(),
  type: z.enum(["googleSheets"]),
  environmentId: z.string(),
  config: ZGoogleSheetsConfig,
});
export type TGoogleSheetIntegration = z.infer<typeof ZGoogleSheetIntegration>;

// Define a specific schema for integration configs
// When we add other configurations it will be z.union([ZGoogleSheetsConfig, ZSlackConfig, ...])
export const ZIntegrationConfig = ZGoogleSheetsConfig;
export type TIntegrationConfig = z.infer<typeof ZIntegrationConfig>;

export const ZIntegration = z.object({
  id: z.string(),
  type: z.enum(["googleSheets"]),
  environmentId: z.string(),
  config: ZIntegrationConfig,
});
export type TIntegration = z.infer<typeof ZIntegration>;

export const ZIntegrationInput = z.object({
  type: z.enum(["googleSheets"]),
  config: ZIntegrationConfig,
});
export type TIntegrationInput = z.infer<typeof ZIntegrationInput>;
