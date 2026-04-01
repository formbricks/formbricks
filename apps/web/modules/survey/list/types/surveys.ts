import { Language, Workspace } from "@prisma/client";
import { z } from "zod";
import { ZSurveyStatus } from "@formbricks/types/surveys/types";

export const ZSurvey = z.object({
  id: z.string(),
  name: z.string(),
  environmentId: z.string(),
  type: z.enum(["link", "app", "website", "web"]), //we can replace this with ZSurveyType after we remove "web" from schema
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

export type TSurvey = z.infer<typeof ZSurvey>;

export const ZSurveyCopyFormValidation = z.object({
  workspaces: z.array(
    z.object({
      workspace: z.string(),
      environments: z.array(z.string()),
    })
  ),
});

export type TSurveyCopyFormData = z.infer<typeof ZSurveyCopyFormValidation>;

export interface TWorkspaceWithLanguages extends Pick<Workspace, "id"> {
  languages: Pick<Language, "code" | "alias">[];
}
