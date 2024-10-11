import { z } from "zod";
import { ZIntegrationBase, ZIntegrationBaseSurveyData } from "./shared-types";

export const ZIntegrationAirtableCredential = z.object({
  expiry_date: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export type TIntegrationAirtableCredential = z.infer<typeof ZIntegrationAirtableCredential>;

export const ZIntegrationAirtableConfigData = z
  .object({
    tableId: z.string(),
    baseId: z.string(),
    tableName: z.string(),
  })
  .merge(ZIntegrationBaseSurveyData);

export type TIntegrationAirtableConfigData = z.infer<typeof ZIntegrationAirtableConfigData>;

export const ZIntegrationAirtableConfig = z.object({
  key: ZIntegrationAirtableCredential,
  data: z.array(ZIntegrationAirtableConfigData),
  email: z.string().email(),
});

export type TIntegrationAirtableConfig = z.infer<typeof ZIntegrationAirtableConfig>;

export const ZIntegrationAirtable = ZIntegrationBase.extend({
  type: z.literal("airtable"),
  config: ZIntegrationAirtableConfig,
});

export type TIntegrationAirtable = z.infer<typeof ZIntegrationAirtable>;

export const ZIntegrationAirtableInput = z.object({
  type: z.literal("airtable"),
  config: ZIntegrationAirtableConfig,
});

export type TIntegrationAirtableInput = z.infer<typeof ZIntegrationAirtableInput>;

export const ZIntegrationAirtableBases = z.object({
  bases: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type TIntegrationAirtableBases = z.infer<typeof ZIntegrationAirtableBases>;

export const ZIntegrationAirtableTables = z.object({
  tables: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type TIntegrationAirtableTables = z.infer<typeof ZIntegrationAirtableTables>;

export const ZIntegrationAirtableTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.coerce.number(),
});

export type TIntegrationAirtableTokenSchema = z.infer<typeof ZIntegrationAirtableTokenSchema>;

export const ZIntegrationAirtableTablesWithFields = z.object({
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

export type TIntegrationAirtableTablesWithFields = z.infer<typeof ZIntegrationAirtableTablesWithFields>;
