import { z } from "zod";
import { ZIntegrationBase, ZIntegrationBaseSurveyData } from "./shared-types";

export const ZIntegrationSlackConfigData = z
  .object({
    // Channel Mapped to a Particular Survey where we have to send the data from the above survey
    channelId: z.string(),
    channelName: z.string(),
  })
  .merge(ZIntegrationBaseSurveyData);

export type TIntegrationSlackConfigData = z.infer<typeof ZIntegrationSlackConfigData>;

export const ZIntegrationSlackCredential = z.object({
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

export type TIntegrationSlackCredential = z.infer<typeof ZIntegrationSlackCredential>;

export const ZIntegrationSlackConfig = z.object({
  key: ZIntegrationSlackCredential,
  data: z.array(ZIntegrationSlackConfigData),
});

export type TIntegrationSlackConfig = z.infer<typeof ZIntegrationSlackConfig>;

export const ZIntegrationSlack = ZIntegrationBase.extend({
  type: z.literal("slack"),
  config: ZIntegrationSlackConfig,
});
export type TIntegrationSlack = z.infer<typeof ZIntegrationSlack>;

export const ZIntegrationSlackInput = z.object({
  type: z.literal("slack"),
  config: ZIntegrationSlackConfig,
});

export type TIntegrationSlackInput = z.infer<typeof ZIntegrationSlackInput>;
