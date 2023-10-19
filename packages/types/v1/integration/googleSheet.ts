import { z } from "zod";
import { ZIntegrationsType, ZIntegrationBaseSurveyData, ZIntegrationBase } from ".";

export const ZGoogleCredential = z.object({
  scope: z.string(),
  token_type: z.literal("Bearer"),
  expiry_date: z.number(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export type TGoogleCredential = z.infer<typeof ZGoogleCredential>;

export const ZIntegrationGoogleSheetsConfigData = z
  .object({
    spreadsheetId: z.string(),
    spreadsheetName: z.string(),
  })
  .merge(ZIntegrationBaseSurveyData);

export type TIntegrationGoogleSheetsConfigData = z.infer<typeof ZIntegrationGoogleSheetsConfigData>;

export const ZIntegrationGoogleSheetsConfig = z.object({
  key: ZGoogleCredential,
  data: z.array(ZIntegrationGoogleSheetsConfigData),
  email: z.string(),
});

export type TIntegrationGoogleSheetsConfig = z.infer<typeof ZIntegrationGoogleSheetsConfig>;

export const ZGoogleSheetIntegration = z.object({
  id: z.string(),
  type: ZIntegrationsType.extract(["googleSheets"]),
  environmentId: z.string(),
  config: ZIntegrationGoogleSheetsConfig,
});

export const ZIntegrationGoogleSheets = ZIntegrationBase.extend({
  type: z.literal("googleSheets"),
  config: ZIntegrationGoogleSheetsConfig,
});

export type TIntegrationGoogleSheets = z.infer<typeof ZIntegrationGoogleSheets>;

export const ZIntegrationGoogleSheetsInput = z.object({
  type: z.enum(["googleSheets"]),
  config: ZIntegrationGoogleSheetsConfig,
});

export type TIntegrationGoogleSheetsInput = z.infer<typeof ZIntegrationGoogleSheetsInput>;
