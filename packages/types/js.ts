import { z } from "zod";
import { ZActionClass } from "./action-classes";
import { ZAttributes } from "./attributes";
import { ZId } from "./common";
import { ZProject } from "./project";
import { ZResponseHiddenFieldValue, ZResponseUpdate } from "./responses";
import { ZUploadFileConfig } from "./storage";
import { ZSurvey } from "./surveys/types";

export const ZJsPerson = z.object({
  id: z.string().cuid2().optional(),
  userId: z.string().optional(),
});

export const ZJsEnvironmentStateSurvey = ZSurvey.innerType()
  .pick({
    id: true,
    name: true,
    welcomeCard: true,
    questions: true,
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
    projectOverwrites: true,
    isBackButtonHidden: true,
  })
  .superRefine(ZSurvey._def.effect.type === "refinement" ? ZSurvey._def.effect.refinement : () => null);

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
  darkOverlay: true,
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
  }),
});

export type TJsEnvironmentState = z.infer<typeof ZJsEnvironmentState>;

export const ZJsSyncInput = z.object({
  environmentId: z.string().cuid(),
});

export type TJsSyncInput = z.infer<typeof ZJsSyncInput>;

export const ZJsPersonState = z.object({
  expiresAt: z.date().nullable(),
  data: z.object({
    userId: z.string().nullable(),
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

export const ZJsUserIdentifyInput = z.object({
  environmentId: z.string().cuid(),
  userId: z.string(),
});

export type TJsPersonIdentifyInput = z.infer<typeof ZJsUserIdentifyInput>;

export const ZJsConfig = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  environmentState: ZJsEnvironmentState,
  personState: ZJsPersonState,
  filteredSurveys: z.array(ZJsEnvironmentStateSurvey).default([]),
  attributes: z.record(z.string()),
  status: z.object({
    value: z.enum(["success", "error"]),
    expiresAt: z.date().nullable(),
  }),
});

export type TJsConfig = z.infer<typeof ZJsConfig>;

export const ZJsConfigUpdateInput = ZJsConfig.omit({ status: true }).extend({
  status: z
    .object({
      value: z.enum(["success", "error"]),
      expiresAt: z.date().nullable(),
    })
    .optional(),
});

export type TJsConfigUpdateInput = z.infer<typeof ZJsConfigUpdateInput>;

export const ZJsConfigInput = z.object({
  environmentId: z.string().cuid2(),
  apiHost: z.string(),
  errorHandler: z.function().args(z.any()).returns(z.void()).optional(),
  userId: z.string().optional(),
  attributes: z.record(z.string()).optional(),
});

export type TJsConfigInput = z.infer<typeof ZJsConfigInput>;

export const ZJsPeopleUserIdInput = z.object({
  environmentId: z.string().cuid2(),
  userId: z.string().min(1).max(255),
});

export const ZJsContactsUpdateAttributeInput = z.object({
  attributes: ZAttributes,
});

export const ZJsUserUpdateInput = z.object({
  userId: z.string().trim().min(1),
  attributes: ZAttributes.optional(),
});

export type TJsPeopleUpdateAttributeInput = z.infer<typeof ZJsContactsUpdateAttributeInput>;

export type TJsPeopleUserIdInput = z.infer<typeof ZJsPeopleUserIdInput>;

export const ZJsPeopleAttributeInput = z.object({
  key: z.string(),
  value: z.string(),
});

export type TJsPeopleAttributeInput = z.infer<typeof ZJsPeopleAttributeInput>;

export const ZJsActionInput = z.object({
  environmentId: z.string().cuid2(),
  userId: z.string().optional(),
  name: z.string(),
});

export type TJsActionInput = z.infer<typeof ZJsActionInput>;

export const ZJsWesbiteActionInput = ZJsActionInput.omit({ userId: true });

export type TJsWesbiteActionInput = z.infer<typeof ZJsWesbiteActionInput>;

export const ZJsEnvironmentSyncParams = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
});

export type TJsEnvironmentSyncParams = z.infer<typeof ZJsEnvironmentSyncParams>;

export const ZJsPersonSyncParams = ZJsEnvironmentSyncParams.extend({
  userId: z.string(),
  attributes: ZAttributes.optional(),
});

export type TJsPersonSyncParams = z.infer<typeof ZJsPersonSyncParams>;

export const ZJsWebsiteSyncParams = ZJsPersonSyncParams.omit({ userId: true });

export type TJsWebsiteSyncParams = z.infer<typeof ZJsWebsiteSyncParams>;

export const ZJsTrackProperties = z.object({
  hiddenFields: ZResponseHiddenFieldValue.optional(),
});

export type TJsTrackProperties = z.infer<typeof ZJsTrackProperties>;

export const ZJsFileUploadParams = z.object({
  file: z.object({ type: z.string(), name: z.string(), base64: z.string() }),
  params: ZUploadFileConfig,
});

export type TJsFileUploadParams = z.infer<typeof ZJsFileUploadParams>;

export const ZJsRNWebViewOnMessageData = z.object({
  onFinished: z.boolean().nullish(),
  onDisplay: z.boolean().nullish(),
  onResponse: z.boolean().nullish(),
  responseUpdate: ZResponseUpdate.nullish(),
  onRetry: z.boolean().nullish(),
  onClose: z.boolean().nullish(),
  onFileUpload: z.boolean().nullish(),
  fileUploadParams: ZJsFileUploadParams.nullish(),
  uploadId: z.string().nullish(),
});
