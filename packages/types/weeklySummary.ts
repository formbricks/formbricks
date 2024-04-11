import { z } from "zod";

import { ZResponseData } from "./responses";
import { ZSurveyQuestion, ZSurveyStatus } from "./surveys";
import { ZUserNotificationSettings } from "./user";

const ZInsights = z.object({
  totalCompletedResponses: z.number(),
  totalDisplays: z.number(),
  totalResponses: z.number(),
  completionRate: z.number(),
  numLiveSurvey: z.number(),
});

export type TInsights = z.infer<typeof ZInsights>;

export const ZSurveyResponseData = z.object({
  headline: z.string(),
  responseValue: z.union([z.string(), z.array(z.string())]),
  questionType: z.string(),
});

export type TSurveyResponseData = z.infer<typeof ZSurveyResponseData>;

export const ZNotificationDataSurvey = z.object({
  id: z.string(),
  name: z.string(),
  responses: z.array(ZSurveyResponseData),
  responseCount: z.number(),
  status: z.string(),
});

export type TNotificationDataSurvey = z.infer<typeof ZNotificationDataSurvey>;

export const ZNotificationResponse = z.object({
  environmentId: z.string(),
  currentDate: z.date(),
  lastWeekDate: z.date(),
  productName: z.string(),
  surveys: z.array(ZNotificationDataSurvey),
  insights: ZInsights,
});

export type TNotificationResponse = z.infer<typeof ZNotificationResponse>;

export const ZWeeklyEmailResponseData = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  finished: z.boolean(),
  data: ZResponseData,
});

export const ZSurveyData = z.object({
  id: z.string(),
  name: z.string(),
  questions: z.array(ZSurveyQuestion),
  status: ZSurveyStatus,
  responses: z.array(ZWeeklyEmailResponseData),
  displays: z.array(z.object({ id: z.string() })),
});

export const ZEnvironmentData = z.object({
  id: z.string(),
  surveys: z.array(ZSurveyData),
});

export type TEnvironmentData = z.infer<typeof ZEnvironmentData>;

export const ZWeeklyemailUserData = z.object({
  email: z.string(),
  notificationSettings: ZUserNotificationSettings,
});

export const ZWeeklyEmailMembershipData = z.object({
  user: ZWeeklyemailUserData,
});
export const ZWeeklyEmailTeamData = z.object({
  memberships: z.array(ZWeeklyEmailMembershipData),
});

export const ZTeamData = z.object({
  memberships: z.array(ZWeeklyEmailMembershipData),
});

export const ZProductData = z.object({
  id: z.string(),
  name: z.string(),
  environments: z.array(ZEnvironmentData),
  team: ZWeeklyEmailTeamData,
});

export type TProductData = z.infer<typeof ZProductData>;
