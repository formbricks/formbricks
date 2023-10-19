import { z } from "zod";
import { ZIntegrationBase, ZIntegrationBaseSurveyData } from ".";

export const ZIntegrationAirtableCredential = z.object({
  expiry_date: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
});

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
  email: z.string(),
});

export type TIntegrationAirtableConfig = z.infer<typeof ZIntegrationAirtableConfig>;

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

export type TIntegrationAirtableTables = z.infer<typeof ZTables>;

export const ZIntegrationAirtable = ZIntegrationBase.extend({
  type: z.literal("airtable"),
  config: ZIntegrationAirtableConfig,
});

export type TIntegrationAirtable = z.infer<typeof ZIntegrationAirtable>;

export const ZIntegrationAirtableInput = z.object({
  type: z.enum(["airtable"]),
  config: ZIntegrationAirtableConfig,
});

export type TIntegrationAirtableInput = z.infer<typeof ZIntegrationAirtableInput>;
