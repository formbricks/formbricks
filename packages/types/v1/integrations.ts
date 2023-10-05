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

export const ZGoogleSheetsConfigData = z.object({
  createdAt: z.date(),
  questionIds: z.array(z.string()),
  questions: z.string(),
  spreadsheetId: z.string(),
  spreadsheetName: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});

const ZGoogleSheetsConfig = z.object({
  key: ZGoogleCredential,
  data: z.array(ZGoogleSheetsConfigData),
  email: z.string(),
});

// Define a dynamic schema for config based on integration type
const ZPlaceholderConfig = z.object({
  placeholder: z.string(),
});

export const ZIntegrationConfig = z.union([ZGoogleSheetsConfig, ZPlaceholderConfig]);

export const ZIntegration = z.object({
  id: z.string(),
  type: z.enum(["googleSheets", "placeholder"]),
  environmentId: z.string(),
  config: ZIntegrationConfig,
});

export const ZGoogleSheetIntegration = z.object({
  id: z.string(),
  type: z.enum(["googleSheets"]),
  environmentId: z.string(),
  config: ZGoogleSheetsConfig,
});

export const ZPlaceHolderIntegration = z.object({
  id: z.string(),
  type: z.enum(["placeholder"]),
  environmentId: z.string(),
  config: ZPlaceholderConfig,
  environment: ZEnvironment,
});

export type TIntegration = z.infer<typeof ZIntegration>;
export type TIntegrationConfig = z.infer<typeof ZIntegrationConfig>;
export type TGoogleCredential = z.infer<typeof ZGoogleCredential>;
export type TGoogleSpreadsheet = z.infer<typeof ZGoogleSpreadsheet>;
export type TGoogleSheetsConfig = z.infer<typeof ZGoogleSheetsConfig>;
export type TGoogleSheetsConfigData = z.infer<typeof ZGoogleSheetsConfigData>;
export type TGoogleSheetIntegration = z.infer<typeof ZGoogleSheetIntegration>;
export type TGoogleSheetIntegrationUpsert = Omit<TGoogleSheetIntegration, "environmentId" | "id">;
export type TPlaceHolderIntegration = z.infer<typeof ZPlaceHolderIntegration>;
