import { z } from "zod";
import { ZActionClass } from "./action-classes";
import { ZId } from "./common";
import { ZProject } from "./project";
import { ZJsEnvironmentStateSegment } from "./segment";
import { ZUploadFileConfig } from "./storage";
import { ZSurveyBase, surveyRefinement } from "./surveys/types";

export const ZJsEnvironmentStateSurvey = ZSurveyBase.pick({
  id: true,
  // name intentionally omitted — internal label, not needed by SDK
  welcomeCard: true,
  questions: true,
  blocks: true,
  variables: true,
  type: true,
  showLanguageSwitch: true,
  languages: true,
  endings: true,
  autoClose: true,
  styling: true,
  status: true,
  // segment intentionally omitted from pick — replaced with minimal shape below
  recontactDays: true,
  displayLimit: true,
  displayOption: true,
  hiddenFields: true,
  triggers: true,
  displayPercentage: true,
  delay: true,
  projectOverwrites: true,
  isBackButtonHidden: true,
  isAutoProgressingEnabled: true,
  recaptcha: true,
})
  .extend({
    // Only expose what the SDK needs: segment ID for membership check + whether any filters exist.
    // Full filter logic (titles, descriptions, conditions) is evaluated server-side and must not
    // be sent to the browser to avoid leaking sensitive targeting data.
    segment: ZJsEnvironmentStateSegment.nullable(),
  })
  .superRefine((survey, ctx) => {
    surveyRefinement(survey as z.infer<typeof ZSurveyBase>, ctx);
  });

export type TJsEnvironmentStateSurvey = z.infer<typeof ZJsEnvironmentStateSurvey>;

export const ZJsEnvironmentStateActionClass = ZActionClass.pick({
  id: true,
  key: true,
  type: true,
  name: true,
  noCodeConfig: true,
});

export type TJsEnvironmentStateActionClass = z.infer<typeof ZJsEnvironmentStateActionClass>;

export const ZJsEnvironmentStateProject = ZProject.pick({
  id: true,
  recontactDays: true,
  clickOutsideClose: true,
  overlay: true,
  placement: true,
  inAppSurveyBranding: true,
  styling: true,
});

export type TJsEnvironmentStateProject = z.infer<typeof ZJsEnvironmentStateProject>;

export const ZJsEnvironmentState = z.object({
  expiresAt: z.date(),
  data: z.object({
    surveys: z.array(ZJsEnvironmentStateSurvey),
    actionClasses: z.array(ZJsEnvironmentStateActionClass),
    project: ZJsEnvironmentStateProject,
    recaptchaSiteKey: z.string().optional(),
  }),
});

export type TJsEnvironmentState = z.infer<typeof ZJsEnvironmentState>;

export const ZJsPersonState = z.object({
  expiresAt: z.date().nullable(),
  data: z.object({
    userId: z.string().nullable(),
    contactId: z.string().nullable(),
    segments: z.array(ZId), // segment ids the person belongs to
    displays: z.array(
      z.object({
        surveyId: ZId,
        createdAt: z.date(),
      })
    ),
    responses: z.array(ZId), // responded survey ids
    lastDisplayAt: z.date().nullable(),
    language: z.string().optional(),
  }),
});

export type TJsPersonState = z.infer<typeof ZJsPersonState>;

export const ZJsFileUploadParams = z.object({
  file: z.object({ type: z.string(), name: z.string(), base64: z.string() }),
  params: ZUploadFileConfig,
});

export type TJsFileUploadParams = z.infer<typeof ZJsFileUploadParams>;
