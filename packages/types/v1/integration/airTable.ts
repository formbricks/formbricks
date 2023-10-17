import { z } from "zod";
import { ZIntegrationBaseSurveyData } from ".";

export const ZAirtableCredential = z.object({
  expiry_date: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export const ZAirTableConfigData = z
  .object({
    tableId: z.string(),
    baseId: z.string(),
    tableName: z.string(),
  })
  .merge(ZIntegrationBaseSurveyData);

export const ZAirTableConfig = z.object({
  key: ZAirtableCredential,
  data: z.array(ZAirTableConfigData),
  email: z.string(),
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
