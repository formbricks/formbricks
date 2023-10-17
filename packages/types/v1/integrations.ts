import { z } from "zod";

// ====================
// COMMON CONFIGURATIONS
// ====================
const ZBaseSurveyData = z.object({
  createdAt: z.date(),
  questionIds: z.array(z.string()),
  questions: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});

export const ZIntegrationType = z.enum(["googleSheets", "airtable"]);
export type TIntegrationType = z.infer<typeof ZIntegrationType>;

export type TIntegrationConfig = z.infer<typeof ZIntegrationConfig>;

// ==========================
// GOOGLE SHEETS CONFIGURATIONS
// ==========================
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

const ZGoogleSheetsConfigData = ZBaseSurveyData.merge(
  z.object({
    spreadsheetId: z.string(),
    spreadsheetName: z.string(),
  })
);

const ZGoogleSheetsConfig = z.object({
  key: ZGoogleCredential,
  data: z.array(ZGoogleSheetsConfigData),
  email: z.string(),
});

export const ZGoogleSheetIntegration = z.object({
  id: z.string(),
  type: z.literal("googleSheets"),
  environmentId: z.string(),
  config: ZGoogleSheetsConfig,
});

export type TGoogleSheetIntegration = z.infer<typeof ZGoogleSheetIntegration>;
export type TGoogleSheetsConfigData = z.infer<typeof ZGoogleSheetsConfigData>;
export type TGoogleCredential = z.infer<typeof ZGoogleCredential>;
export type TGoogleSpreadsheet = z.infer<typeof ZGoogleSpreadsheet>;
export type TGoogleSheetIntegrationInput = Pick<TGoogleSheetIntegration, "type" | "config">;

// ==========================
// AIRTABLE CONFIGURATIONS
// ==========================
export const ZAirtable = z.object({
  name: z.string(),
  id: z.string(),
});

export const ZAirtableCredential = z.object({
  expiry_date: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
});

const ZAirTableConfigData = ZBaseSurveyData.merge(
  z.object({
    tableId: z.string(),
    baseId: z.string(),
    tableName: z.string(),
  })
);

const ZAirTableConfig = z.object({
  key: ZAirtableCredential,
  data: z.array(ZAirTableConfigData),
  email: z.string(),
});

export const ZAirTableIntegration = z.object({
  id: z.string(),
  type: z.literal("airtable"),
  environmentId: z.string(),
  config: ZAirTableConfig,
});

export const ZAirtableTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.coerce.number(),
});

export const ZBases = z.object({
  bases: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const ZTables = z.object({
  tables: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const ZTablesWithFields = z.object({
  tables: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      fields: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
        })
      ),
    })
  ),
});

export type TAirtableTables = z.infer<typeof ZTables>;
export type TAirTableIntegration = z.infer<typeof ZAirTableIntegration>;
export type TAirtable = z.infer<typeof ZAirtable>;
export type TAirTableConfigData = z.infer<typeof ZAirTableConfigData>;
export type TAirtableCredential = z.infer<typeof ZAirtableCredential>;
export type TAirtableIntegrationInput = Pick<TAirTableIntegration, "type" | "config">;

// ==========================
// COMBINED CONFIGURATIONS
// ==========================
export const ZIntegrationConfig = z.union([ZGoogleSheetsConfig, ZAirTableConfig]);
export const ZIntegration = z.object({
  id: z.string(),
  type: ZIntegrationType,
  environmentId: z.string(),
  config: ZIntegrationConfig,
});
export type TIntegration = z.infer<typeof ZIntegration>;
export type TIntegrationInput = TGoogleSheetIntegrationInput | TAirtableIntegrationInput;
