import { z } from "zod";
import { ZIntegrationBase, ZIntegrationBaseSurveyData } from "./shared-types";

export const ZIntegrationPlainCredential = z.object({
  access_token: z.string(),
  workspace_icon: z.string().nullable(),
  workspace_id: z.string(),
  workspace_name: z.string().nullable(),
});

export type TIntegrationPlainCredential = z.infer<typeof ZIntegrationPlainCredential>;

export const ZIntegrationPlainConfigData = z
  .object({
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
  })
  .merge(
    ZIntegrationBaseSurveyData.omit({
      questionIds: true,
      questions: true,
    })
  );

export type TIntegrationPlainConfigData = z.infer<typeof ZIntegrationPlainConfigData>;

export const ZIntegrationPlainConfig = z.object({
  key: ZIntegrationPlainCredential,
  data: z.array(ZIntegrationPlainConfigData),
});

export type TIntegrationPlainConfig = z.infer<typeof ZIntegrationPlainConfig>;

export const ZIntegrationPlain = ZIntegrationBase.extend({
  type: z.literal("plain"),
  config: ZIntegrationPlainConfig,
});

export type TIntegrationPlain = z.infer<typeof ZIntegrationPlain>;

export const ZIntegrationPlainInput = z.object({
  type: z.literal("plain"),
  config: ZIntegrationPlainConfig,
});

export type TIntegrationPlainInput = z.infer<typeof ZIntegrationPlainInput>;

export const ZIntegrationPlainDatabase = z.object({
  id: z.string(),
  name: z.string(),
  properties: z.object({}),
});

export type TIntegrationPlainDatabase = z.infer<typeof ZIntegrationPlainDatabase>;
