import { Language, Project } from "@prisma/client";
import { z } from "zod";
import { ZSurveyStatus } from "@formbricks/types/surveys/types";

export const ZSurvey = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
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
  projects: z.array(
    z.object({
      project: z.string(),
      environments: z.array(z.string()),
    })
  ),
});

export type TSurveyCopyFormData = z.infer<typeof ZSurveyCopyFormValidation>;

export interface TProjectWithLanguages extends Pick<Project, "id"> {
  languages: Pick<Language, "code" | "alias">[];
}
