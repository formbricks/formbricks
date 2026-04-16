import { z } from "zod";
import { ZActionClass } from "./action-classes";
import { ZId } from "./common";
import { ZUploadFileConfig } from "./storage";
import { ZSurveyBase, surveyRefinement } from "./surveys/types";
import { ZWorkspace } from "./workspace";

export const ZJsWorkspaceStateSurvey = ZSurveyBase.pick({
  id: true,
  name: true,
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
  segment: true,
  recontactDays: true,
  displayLimit: true,
  displayOption: true,
  hiddenFields: true,
  triggers: true,
  displayPercentage: true,
  delay: true,
  workspaceOverwrites: true,
  isBackButtonHidden: true,
  isAutoProgressingEnabled: true,
  recaptcha: true,
}).superRefine((survey, ctx) => {
  surveyRefinement(survey as z.infer<typeof ZSurveyBase>, ctx);
});

export type TJsWorkspaceStateSurvey = z.infer<typeof ZJsWorkspaceStateSurvey>;

export const ZJsWorkspaceStateActionClass = ZActionClass.pick({
  id: true,
  key: true,
  type: true,
  name: true,
  noCodeConfig: true,
});

export type TJsWorkspaceStateActionClass = z.infer<typeof ZJsWorkspaceStateActionClass>;

export const ZJsWorkspaceStateWorkspaceSetting = ZWorkspace.pick({
  recontactDays: true,
  clickOutsideClose: true,
  overlay: true,
  placement: true,
  inAppSurveyBranding: true,
  styling: true,
});

export type TJsWorkspaceStateWorkspaceSetting = z.infer<typeof ZJsWorkspaceStateWorkspaceSetting>;

export const ZJsWorkspaceState = z.object({
  expiresAt: z.date(),
  data: z.object({
    surveys: z.array(ZJsWorkspaceStateSurvey),
    actionClasses: z.array(ZJsWorkspaceStateActionClass),
    workspace: ZJsWorkspaceStateWorkspaceSetting,
    recaptchaSiteKey: z.string().optional(),
  }),
});

export type TJsWorkspaceState = z.infer<typeof ZJsWorkspaceState>;

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
