import { z } from "zod";
import { ZSurveyStatus } from "@formbricks/types/surveys/types";

export const ZSurveyOverviewType = z.enum(["link", "app"]);
export const ZSurveyOverviewSort = z.enum(["createdAt", "updatedAt", "name", "relevance"]);
export const ZSurveyOverviewFilters = z.object({
  name: z.string(),
  status: z.array(ZSurveyStatus),
  type: z.array(ZSurveyOverviewType),
  sortBy: ZSurveyOverviewSort,
});

export const ZSurveyListItem = z.object({
  id: z.string(),
  name: z.string(),
  workspaceId: z.string(),
  type: z.enum(["link", "app", "website", "web"]),
  status: ZSurveyStatus,
  createdAt: z.date(),
  updatedAt: z.date(),
  responseCount: z.number(),
  creator: z
    .object({
      name: z.string(),
    })
    .nullable(),
  singleUse: z
    .object({
      enabled: z.boolean(),
      isEncrypted: z.boolean(),
    })
    .nullable(),
});

export type TSurveyOverviewType = z.infer<typeof ZSurveyOverviewType>;
export type TSurveyOverviewStatus = z.infer<typeof ZSurveyStatus>;
export type TSurveyOverviewSort = z.infer<typeof ZSurveyOverviewSort>;
export type TSurveyOverviewFilters = z.infer<typeof ZSurveyOverviewFilters>;
export type TSurveyListItem = z.infer<typeof ZSurveyListItem>;
