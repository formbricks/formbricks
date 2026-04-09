import { z } from "zod";
import { ZSurveyWithoutQuestionType } from "@formbricks/database/zod/surveys";

export const ZGetSurveysFilter = z
  .object({
    limit: z.coerce.number().positive().min(1).max(100).optional().prefault(10),
    skip: z.coerce.number().nonnegative().optional().prefault(0),
    sortBy: z.enum(["createdAt", "updatedAt"]).optional().prefault("createdAt"),
    order: z.enum(["asc", "desc"]).optional().prefault("desc"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    surveyType: z.enum(["link", "app"]).optional(),
    surveyStatus: z.enum(["draft", "inProgress", "paused", "completed"]).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate && data.startDate > data.endDate) {
        return false;
      }
      return true;
    },
    {
      error: "startDate must be before endDate",
    }
  );

export const ZSurveyInput = ZSurveyWithoutQuestionType.pick({
  name: true,
  redirectUrl: true,
  type: true,
  environmentId: true,
  questions: true,
  blocks: true,
  endings: true,
  hiddenFields: true,
  variables: true,
  displayOption: true,
  recontactDays: true,
  displayLimit: true,
  autoClose: true,
  autoComplete: true,
  delay: true,
  singleUse: true,
  isVerifyEmailEnabled: true,
  isSingleResponsePerEmailEnabled: true,
  inlineTriggers: true,
  displayPercentage: true,
  welcomeCard: true,
  surveyClosedMessage: true,
  styling: true,
  projectOverwrites: true,
  showLanguageSwitch: true,
})
  .partial({
    redirectUrl: true,
    endings: true,
    variables: true,
    recontactDays: true,
    displayLimit: true,
    autoClose: true,
    autoComplete: true,
    surveyClosedMessage: true,
    styling: true,
    projectOverwrites: true,
    showLanguageSwitch: true,
    inlineTriggers: true,
    displayPercentage: true,
  })
  .meta({
    id: "surveyInput",
    description: "A survey input object for creating or updating surveys",
  });

export type TSurveyInput = z.infer<typeof ZSurveyInput>;
