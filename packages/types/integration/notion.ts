import { z } from "zod";
import { ZIntegrationBase, ZIntegrationBaseSurveyData } from "./shared-types";

export const ZIntegrationNotionCredential = z.object({
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
          email: z.string().email(),
        }),
        avatar_url: z.string(),
      })
      .nullable(),
  }),
  workspace_icon: z.string().nullable(),
  workspace_id: z.string(),
  workspace_name: z.string().nullable(),
});

export type TIntegrationNotionCredential = z.infer<typeof ZIntegrationNotionCredential>;

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
  .merge(
    ZIntegrationBaseSurveyData.omit({
      questionIds: true,
      questions: true,
    })
  );

export type TIntegrationNotionConfigData = z.infer<typeof ZIntegrationNotionConfigData>;

export const ZIntegrationNotionConfig = z.object({
  key: ZIntegrationNotionCredential,
  data: z.array(ZIntegrationNotionConfigData),
});

export type TIntegrationNotionConfig = z.infer<typeof ZIntegrationNotionConfig>;

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

export const ZIntegrationNotionDatabase = z.object({
  id: z.string(),
  name: z.string(),
  properties: z.object({}),
});

export type TIntegrationNotionDatabase = z.infer<typeof ZIntegrationNotionDatabase>;
