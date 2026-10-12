import { z } from "zod";
import { ZSurveyStatus, ZSurveyVisibility } from "@formbricks/types/surveys/types";

export const ZSurveyOverviewType = z.enum(["link", "app"]);
export const ZSurveyOverviewSort = z.enum(["createdAt", "updatedAt", "name", "relevance"]);
// "archived" is a pseudo-status used only by the list filter UI. It is not a real
// SurveyStatus; the server translates it into an archivedAt filter.
export const ZSurveyOverviewStatus = z.union([ZSurveyStatus, z.literal("archived")]);
export const ZSurveyOverviewFilters = z.object({
  name: z.string(),
  status: z.array(ZSurveyOverviewStatus),
  type: z.array(ZSurveyOverviewType),
  // ENG-3395: session-only — never written to or read from the remembered filters.
  visibility: z.array(ZSurveyVisibility),
  sortBy: ZSurveyOverviewSort,
});

// Mirrors `TSurveyAccess` in `lib/survey/visibility/access.ts`, the v3 representations' `access` field.
export const ZSurveyListItemAccess = z.object({
  via: z.enum(["organizationRole", "owner", "workspace"]),
  canManageVisibility: z.boolean(),
});

export const ZSurveyListItem = z.object({
  id: z.string(),
  name: z.string(),
  workspaceId: z.string(),
  type: z.enum(["link", "app", "website", "web"]),
  status: ZSurveyStatus,
  publishOn: z.date().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  responseCount: z.number(),
  completedResponseCount: z.number(),
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
  // ENG-3282: the visibility enforced on this request, the display-only author, and why the caller can see it.
  visibility: ZSurveyVisibility,
  owner: z.object({ name: z.string() }).nullable(),
  access: ZSurveyListItemAccess,
});

export type TSurveyOverviewType = z.infer<typeof ZSurveyOverviewType>;
export type TSurveyOverviewStatus = z.infer<typeof ZSurveyOverviewStatus>;
export type TSurveyOverviewSort = z.infer<typeof ZSurveyOverviewSort>;
export type TSurveyOverviewFilters = z.infer<typeof ZSurveyOverviewFilters>;
export type TSurveyListItem = z.infer<typeof ZSurveyListItem>;
export type TSurveyListItemAccess = z.infer<typeof ZSurveyListItemAccess>;
