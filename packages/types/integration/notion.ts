import { z } from "zod";
import { ZIntegrationBase, ZIntegrationBaseSurveyData } from "./sharedTypes";

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

export const ZIntegrationNotionConfigData = z
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
  .merge(ZIntegrationBaseSurveyData);

export type TIntegrationNotionConfigData = z.infer<typeof ZIntegrationNotionConfigData>;

export const ZIntegrationNotionConfig = z.object({
  key: ZNotionCredential,
  data: z.array(ZIntegrationNotionConfigData),
});

export type TIntegrationNotionConfig = z.infer<typeof ZIntegrationNotionConfig>;

export const ZNotionIntegration = z.object({
  id: z.string(),
  type: z.literal("notion"),
  environmentId: z.string(),
  config: ZIntegrationNotionConfig,
});

export const ZIntegrationNotion = ZIntegrationBase.extend({
  type: z.literal("notion"),
  config: ZIntegrationNotionConfig,
});

export type TIntegrationNotion = z.infer<typeof ZIntegrationNotion>;

export const ZIntegrationNotionInput = z.object({
  type: z.literal("notion"),
  config: ZIntegrationNotionConfig,
});

export type TIntegrationNotionInput = z.infer<typeof ZIntegrationNotionInput>;

export const ZNotionDatabase = z.object({
  id: z.string(),
  name: z.string(),
  properties: z.object({}),
});

export type TNotionDatabase = z.infer<typeof ZNotionDatabase>;
