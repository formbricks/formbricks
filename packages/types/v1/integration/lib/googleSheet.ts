import { z } from "zod";
import { ZIntegrationsTypes, ZBaseSurveyData } from "../";

export const ZGoogleCredential = z.object({
  scope: z.string(),
  token_type: z.literal("Bearer"),
  expiry_date: z.number(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export const ZGoogleSheetsConfigData = z
  .object({
    spreadsheetId: z.string(),
    spreadsheetName: z.string(),
  })
  .merge(ZBaseSurveyData);

export const ZGoogleSheetsConfig = z.object({
  key: ZGoogleCredential,
  data: z.array(ZGoogleSheetsConfigData),
  email: z.string(),
});

export const ZGoogleSheetIntegration = z.object({
  id: z.string(),
  type: ZIntegrationsTypes.extract(["googleSheets"]),
  environmentId: z.string(),
  config: ZGoogleSheetsConfig,
});
