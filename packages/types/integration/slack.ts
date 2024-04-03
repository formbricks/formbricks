import { z } from "zod";

import { ZIntegrationBase, ZIntegrationBaseSurveyData } from "./sharedTypes";

export const ZIntegrationSlackConfigData = z
  .object({
    // Channel Mapped to a Particular Survey where we have to send the data from the above survey
    channelId: z.string(),
    channelName: z.string(),
  })
  .merge(ZIntegrationBaseSurveyData);

export type TIntegrationSlackConfigData = z.infer<typeof ZIntegrationSlackConfigData>;

export const ZIntegrationSlackCredential = z.object({
  token_type: z.literal("Bearer"),
  access_token: z.string(),
});

export type TIntegrationSlackCredential = z.infer<typeof ZIntegrationSlackCredential>;

export const ZSlackUser = z.object({
  id: z.string().optional(),
  name: z.string(),
});

export const ZIntegrationSlackConfig = z.object({
  key: ZIntegrationSlackCredential,
  data: z.array(ZIntegrationSlackConfigData),
  user: ZSlackUser,
});

export type TIntegrationSlackConfig = z.infer<typeof ZIntegrationSlackConfig>;

export const ZSlackIntegration = z.object({
  id: z.string(),
  type: z.literal("slack"),
  environmentId: z.string(),
  config: ZIntegrationSlackConfig,
});

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
