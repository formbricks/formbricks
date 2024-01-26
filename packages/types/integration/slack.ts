import { z } from "zod";

import { ZIntegrationBase, ZIntegrationBaseSurveyData } from "./sharedTypes";

export const ZSlackCredential = z.object({
  token_type: z.literal("Bearer"),
  id_token: z.string(),
  expiry_date: z.number(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export type TSlackCredential = z.infer<typeof ZSlackCredential>;

export const ZIntegrationSlackConfigData = z
  .object({
    // Channel Mapped to a Particular Survey where we have to send the data from the above survey
    channelId: z.string(),
    channelName: z.string(),
  })
  .merge(ZIntegrationBaseSurveyData);

export const ZSlackConfigData = z.object({
  createdAt: z.date(),

  // Data sent from formbricks
  questionIds: z.array(z.string()),
  questions: z.string(),
  surveyId: z.string(),
  surveyName: z.string(),

  // Channel Mapped to a Particular Survey where we have to send the data from the above survey
  channelId: z.string(),
  channelName: z.string(),
});

export const ZSlackUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email("Not a valid email address"),
  avatar: z.string().url("Avatar must be a url"),
});

export const ZIntegrationSlackConfig = z.object({
  key: ZSlackCredential,
  data: z.array(ZIntegrationSlackConfigData),
  user: ZSlackUser,
});

export type TIntegrationSlackConfig = z.infer<typeof ZIntegrationSlackConfig>;

export const ZSlackChannel = z.object({
  name: z.string(),
  id: z.string(),
});

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

export const ZSlackConfig = z.object({
  key: ZSlackCredential,
  data: z.array(ZSlackConfigData),
  user: ZSlackUser,
});

export const ZIntegrationSlackCredential = z.object({
  token_type: z.literal("Bearer"),
  id_token: z.string(),
  expiry_date: z.number(),
  access_token: z.string(),
  refresh_token: z.string(),
});

export type TIntegrationSlackCredential = z.infer<typeof ZIntegrationSlackCredential>;

export type TSlackConfig = z.infer<typeof ZSlackConfig>;
export type TSlackConfigData = z.infer<typeof ZSlackConfigData>;
export type TSlackIntegration = z.infer<typeof ZSlackIntegration>;
export type TSlackUser = z.infer<typeof ZSlackUser>;
export type TSlackChannel = z.infer<typeof ZSlackChannel>;
