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
    id: z.string()
});

export const ZGoogleSheetsConfigData = z.object({
    createdAt: z.date(),
    questionIds: z.array(z.string()),
    questions: z.string(),
    spreadsheetId: z.string(),
    spreadsheetName: z.string(),
    surveyId: z.string(),
    surveyName: z.string()
});


const ZGoogleSheetsConfig =z.object({
    key: ZGoogleCredential,
    data: z.array(ZGoogleSheetsConfigData)
})

// Define a dynamic schema for config based on integration type
const ZPlaceholderConfig =z.object({
    placeholder: z.string()
})

export const ZIntegration = z.object({
    id: z.string(),
    type: z.enum(["googleSheets"]),
    environmentId: z.string(),
    config: z.union([ZGoogleSheetsConfig,ZPlaceholderConfig]),
    environment: ZEnvironment,
});

export const ZGoogleSheetIntegration = z.object({
    id: z.string(),
    type: z.enum(["googleSheets"]),
    environmentId: z.string(),
    config: ZGoogleSheetsConfig,
    environment: ZEnvironment,
});


export type TIntegration = z.infer<typeof ZIntegration>;
export type TGoogleCredential = z.infer<typeof ZGoogleCredential>;
export type TGoogleSpreadsheet = z.infer<typeof ZGoogleSpreadsheet>;
export type TGoogleSheetsConfig = z.infer<typeof ZGoogleSheetsConfig>;
export type TGoogleSheetsConfigData = z.infer<typeof ZGoogleSheetsConfigData>;
export type TGoogleSheetIntegration = z.infer<typeof ZGoogleSheetIntegration>;

