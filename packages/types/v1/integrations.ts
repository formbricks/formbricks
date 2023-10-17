import { z } from "zod";
import { ZEnvironment } from "./environment";

// Schema for the slack configuration
export const ZSlackCredential = z.object({
  token_type: z.literal("Bearer"),
  id_token: z.string(),
  expiry_date: z.number(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export const ZSlackConfigData = z.object({
  createdAt: z.date(),

  // Data sent from formbricks
  questionIds: z.array(z.string()),
  questions: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),

  // Channel Mapped to a Particular Survey where we have to send the data from the above survey
  channelId: z.string(),
  channelName: z.string(),
});

export const ZSlackConfig = z.object({
  key: ZSlackCredential,
  data: z.array(ZSlackConfigData),
  email: z.string(),
});

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

export const ZIntegrationConfig = z.union([ZGoogleSheetsConfig, ZPlaceholderConfig, ZSlackConfig]);

export const ZIntegration = z.object({
  id: z.string(),
  type: z.enum(["googleSheets", "placeholder", "slack"]),
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

export const ZSlackIntegration = z.object({
  id: z.string(),
  type: z.enum(["slack"]),
  environmentId: z.string(),
  config: ZSlackConfig,
});

// ================= Generic Integration Types ===============================
export type TIntegration = z.infer<typeof ZIntegration>;
export type TIntegrationConfig = z.infer<typeof ZIntegrationConfig>;

// =============== GoogleSheets Integration Types ============================
export type TGoogleCredential = z.infer<typeof ZGoogleCredential>;
export type TGoogleSpreadsheet = z.infer<typeof ZGoogleSpreadsheet>;
export type TGoogleSheetsConfig = z.infer<typeof ZGoogleSheetsConfig>;
export type TGoogleSheetsConfigData = z.infer<typeof ZGoogleSheetsConfigData>;
export type TGoogleSheetIntegration = z.infer<typeof ZGoogleSheetIntegration>;

// ================== Slack Integration Types ================================
export type TSlackCredential = z.infer<typeof ZSlackCredential>;
export type TSlackConfig = z.infer<typeof ZSlackConfig>;
export type TSlackConfigData = z.infer<typeof ZSlackConfigData>;
export type TSlackIntegration = z.infer<typeof ZSlackIntegration>;

export type TPlaceHolderIntegration = z.infer<typeof ZPlaceHolderIntegration>;
