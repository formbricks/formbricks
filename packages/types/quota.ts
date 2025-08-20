import { z } from "zod";
import { ZSingleCondition } from "./surveys/types";

// Connector type for combining criteria with AND/OR logic
export const ZConnector = z.enum(["and", "or"]);

// Complete quota conditions structure
export const ZSurveyQuotaConditions = z.object({
  connector: ZConnector,
  criteria: z.array(ZSingleCondition),
});
export type TSurveyQuotaConditions = z.infer<typeof ZSurveyQuotaConditions>;

// Survey quota action enum
export const ZSurveyQuotaAction = z.enum(["endSurvey", "continueSurvey"]);
export type TSurveyQuotaAction = z.infer<typeof ZSurveyQuotaAction>;

// Response quota link status enum
export const ZResponseQuotaLinkStatus = z.enum(["screenedIn", "screenedOut"]);
export type TResponseQuotaLinkStatus = z.infer<typeof ZResponseQuotaLinkStatus>;

// Survey quota model
export const ZSurveyQuota = z.object({
  id: z.string().cuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveyId: z.string(),
  name: z.string().min(1, { message: "Quota name is required" }),
  limit: z.number().positive().min(1, { message: "Limit must be greater than 0" }),
  conditions: ZSurveyQuotaConditions,
  action: ZSurveyQuotaAction,
  endingCardId: z.string().nullable(),
  countPartialSubmissions: z.boolean(),
});
export type TSurveyQuota = z.infer<typeof ZSurveyQuota>;

export const ZSurveyQuotaCreateInput = ZSurveyQuota.omit({ id: true, createdAt: true, updatedAt: true });
export type TSurveyQuotaCreateInput = z.infer<typeof ZSurveyQuotaCreateInput>;

export const ZSurveyQuotaUpdateInput = ZSurveyQuota.omit({ id: true, createdAt: true, updatedAt: true });
export type TSurveyQuotaUpdateInput = z.infer<typeof ZSurveyQuotaUpdateInput>;

export const ZResponseQuotaLink = z.object({
  responseId: z.string(),
  quotaId: z.string(),
  status: ZResponseQuotaLinkStatus,
});
export type TResponseQuotaLink = z.infer<typeof ZResponseQuotaLink>;
