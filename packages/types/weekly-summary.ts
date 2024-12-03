import { z } from "zod";
import { ZContactAttributeKey } from "./contact-attribute-key";
import { ZResponseData } from "./responses";
import { ZSurveyHiddenFields, ZSurveyQuestion, ZSurveyQuestionType, ZSurveyStatus } from "./surveys/types";
import { ZUserNotificationSettings } from "./user";

const ZWeeklySummaryInsights = z.object({
  totalCompletedResponses: z.number(),
  totalDisplays: z.number(),
  totalResponses: z.number(),
  completionRate: z.number(),
  numLiveSurvey: z.number(),
});

export type TWeeklySummaryInsights = z.infer<typeof ZWeeklySummaryInsights>;

export const ZWeeklySummarySurveyResponseData = z.object({
  headline: z.string(),
  responseValue: z.union([z.string(), z.array(z.string())]),
  questionType: ZSurveyQuestionType,
});

export type TWeeklySummarySurveyResponseData = z.infer<typeof ZWeeklySummarySurveyResponseData>;

export const ZWeeklySummaryNotificationDataSurvey = z.object({
  id: z.string(),
  name: z.string(),
  responses: z.array(ZWeeklySummarySurveyResponseData),
  responseCount: z.number(),
  status: ZSurveyStatus,
});

export type TWeeklySummaryNotificationDataSurvey = z.infer<typeof ZWeeklySummaryNotificationDataSurvey>;

export const ZWeeklySummaryNotificationResponse = z.object({
  environmentId: z.string(),
  currentDate: z.date(),
  lastWeekDate: z.date(),
  projectName: z.string(),
  surveys: z.array(ZWeeklySummaryNotificationDataSurvey),
  insights: ZWeeklySummaryInsights,
});

export type TWeeklySummaryNotificationResponse = z.infer<typeof ZWeeklySummaryNotificationResponse>;

export const ZWeeklyEmailResponseData = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  finished: z.boolean(),
  data: ZResponseData,
});

export type TWeeklyEmailResponseData = z.infer<typeof ZWeeklyEmailResponseData>;

export const ZWeeklySummarySurveyData = z.object({
  id: z.string(),
  name: z.string(),
  questions: z.array(ZSurveyQuestion),
  status: ZSurveyStatus,
  responses: z.array(ZWeeklyEmailResponseData),
  displays: z.array(z.object({ id: z.string() })),
  hiddenFields: ZSurveyHiddenFields,
});

export type TWeeklySummarySurveyData = z.infer<typeof ZWeeklySummarySurveyData>;

export const ZWeeklySummaryEnvironmentData = z.object({
  id: z.string(),
  surveys: z.array(ZWeeklySummarySurveyData),
  attributeKeys: z.array(ZContactAttributeKey),
});

export type TWeeklySummaryEnvironmentData = z.infer<typeof ZWeeklySummaryEnvironmentData>;

export const ZWeeklySummaryUserData = z.object({
  id: z.string(),
  email: z.string(),
  notificationSettings: ZUserNotificationSettings,
  locale: z.string(),
});

export type TWeeklySummaryUserData = z.infer<typeof ZWeeklySummaryUserData>;

export const ZWeeklySummaryMembershipData = z.object({
  user: ZWeeklySummaryUserData,
});

export type TWeeklySummaryMembershipData = z.infer<typeof ZWeeklySummaryMembershipData>;

export const ZWeeklyEmailOrganizationData = z.object({
  memberships: z.array(ZWeeklySummaryMembershipData),
});

export type TWeeklyEmailOrganizationData = z.infer<typeof ZWeeklyEmailOrganizationData>;

export const ZWeeklySummaryProjectData = z.object({
  id: z.string(),
  name: z.string(),
  environments: z.array(ZWeeklySummaryEnvironmentData),
  organization: ZWeeklyEmailOrganizationData,
});

export type TWeeklySummaryProjectData = z.infer<typeof ZWeeklySummaryProjectData>;
