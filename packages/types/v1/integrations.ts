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

/* NOTION CONFIGURATIONS */
export const ZNotionConfigData = z.object({
  createdAt: z.date(),
  // question -> notion database column mapping
  mapping: z.array(
    z.object({
      question: z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
      }),
      column: z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
      }),
    })
  ),
  databaseId: z.string(),
  databaseName: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),
});

export type TNotionConfigData = z.infer<typeof ZNotionConfigData>;

export const ZNotionCredential = z.object({
  access_token: z.string(),
  bot_id: z.string(),
  token_type: z.string(),
  duplicated_template_id: z.string().nullable(),
  owner: z.object({
    type: z.string(),
    workspace: z.boolean().nullable(),
    user: z
      .object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        object: z.string(),
        person: z.object({
          email: z.string(),
        }),
        avatar_url: z.string(),
      })
      .nullable(),
  }),
  workspace_icon: z.string().nullable(),
  workspace_id: z.string(),
  workspace_name: z.string().nullable(),
});

export type TNotionCredential = z.infer<typeof ZNotionCredential>;

const ZNotionConfig = z.object({
  key: ZNotionCredential,
  data: z.array(ZNotionConfigData),
});

export type TNotionConfig = z.infer<typeof ZNotionConfig>;

export const ZNotionIntegration = z.object({
  id: z.string(),
  type: z.enum(["notion"]),
  environmentId: z.string(),
  config: ZNotionConfig,
});

export type TNotionIntegration = z.infer<typeof ZNotionIntegration>;

export const ZNotionDatabase = z.object({
  name: z.string(),
  id: z.string(),
  properties: z.object({}),
});

export type TNotionDatabase = z.infer<typeof ZNotionDatabase>;

// Define a specific schema for integration configs
export const ZIntegrationConfig = z.union([ZGoogleSheetsConfig, ZNotionConfig]);
export type TIntegrationConfig = z.infer<typeof ZIntegrationConfig>;

export const ZIntegration = z.object({
  id: z.string(),
  type: z.enum(["googleSheets", "notion"]),
  environmentId: z.string(),
  config: ZIntegrationConfig,
});
export type TIntegration = z.infer<typeof ZIntegration>;

export const ZIntegrationInput = z.object({
  type: z.enum(["googleSheets", "notion"]),
  config: ZIntegrationConfig,
});

export type TIntegrationInput = z.infer<typeof ZIntegrationInput>;
