import { z } from "zod";
import { ZSurvey } from "@formbricks/database/zod/surveys";

export const ZGetSurveysFilter = z
  .object({
    limit: z.coerce.number().positive().min(1).max(100).optional().default(10),
    skip: z.coerce.number().nonnegative().optional().default(0),
    sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    surveyType: z.enum(["link", "app"]).optional(),
    surveyStatus: z.enum(["draft", "scheduled", "inProgress", "paused", "completed"]).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate && data.startDate > data.endDate) {
        return false;
      }
      return true;
    },
    {
      message: "startDate must be before endDate",
    }
  );

export const ZSurveyInput = ZSurvey.pick({
  name: true,
  redirectUrl: true,
  type: true,
  environmentId: true,
  questions: true,
  endings: true,
  thankYouCard: true,
  hiddenFields: true,
  variables: true,
  displayOption: true,
  recontactDays: true,
  displayLimit: true,
  autoClose: true,
  autoComplete: true,
  delay: true,
  runOnDate: true,
  closeOnDate: true,
  singleUse: true,
  isVerifyEmailEnabled: true,
  isSingleResponsePerEmailEnabled: true,
  inlineTriggers: true,
  verifyEmail: true,
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
    thankYouCard: true,
    variables: true,
    recontactDays: true,
    displayLimit: true,
    autoClose: true,
    autoComplete: true,
    runOnDate: true,
    closeOnDate: true,
    surveyClosedMessage: true,
    styling: true,
    projectOverwrites: true,
    showLanguageSwitch: true,
    inlineTriggers: true,
    verifyEmail: true,
    displayPercentage: true,
  })
  .openapi({
    ref: "surveyInput",
    description: "A survey input object for creating or updating surveys",
  });

export type TSurveyInput = z.infer<typeof ZSurveyInput>;
