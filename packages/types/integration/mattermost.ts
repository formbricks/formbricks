import { z } from "zod";
import { ZIntegrationBase, ZIntegrationBaseSurveyData } from "./shared-types";

export const ZIntegrationMattermostConfigData = z
  .object({
    // Channel Mapped to a Particular Survey where we have to send the data from the above survey
    channelId: z.string(),
    channelName: z.string(),
  })
  .merge(ZIntegrationBaseSurveyData);

export type TIntegrationMattermostConfigData = z.infer<typeof ZIntegrationMattermostConfigData>;

export const ZIntegrationMattermostCredential = z.object({
  app_id: z.string(),
  authed_user: z.object({
    id: z.string(),
  }),
  token_type: z.literal("bot"),
  access_token: z.string(),
  bot_user_id: z.string(),
  team: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export type TIntegrationMattermostCredential = z.infer<typeof ZIntegrationMattermostCredential>;

export const ZIntegrationMattermostConfig = z.object({
  key: ZIntegrationMattermostCredential,
  data: z.array(ZIntegrationMattermostConfigData),
});

export type TIntegrationMattermostConfig = z.infer<typeof ZIntegrationMattermostConfig>;

export const ZIntegrationMattermost = ZIntegrationBase.extend({
  type: z.literal("mattermost"),
  config: ZIntegrationMattermostConfig,
});
export type TIntegrationMattermost = z.infer<typeof ZIntegrationMattermost>;

export const ZIntegrationMattermostInput = z.object({
  type: z.literal("mattermost"),
  config: ZIntegrationMattermostConfig,
});

export type TIntegrationMattermostInput = z.infer<typeof ZIntegrationMattermostInput>;
