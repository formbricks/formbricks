import { z } from "zod";
import { ZActionClass } from "./action-classes";
import { ZAttributes } from "./attributes";
import { ZId } from "./common";
import { ZProduct } from "./product";
import { ZResponseHiddenFieldValue, ZResponseUpdate } from "./responses";
import { ZUploadFileConfig } from "./storage";
import { ZSurvey } from "./surveys/types";

export const ZJsPerson = z.object({
  id: z.string().cuid2().optional(),
  userId: z.string().optional(),
});

export type TJsPerson = z.infer<typeof ZJsPerson>;

// ZSurvey is a refinement, so to extend it to ZSurveyWithTriggers, we need to extend the innerType and then apply the same refinements.
const ZSurveyWithTriggers = ZSurvey.innerType()
  .extend({
    triggers: z.array(ZActionClass).or(z.array(z.string())),
  })
  .superRefine(ZSurvey._def.effect.type === "refinement" ? ZSurvey._def.effect.refinement : () => null);

export type TSurveyWithTriggers = z.infer<typeof ZSurveyWithTriggers>;

export const ZJSWebsiteStateDisplay = z.object({
  createdAt: z.date(),
  surveyId: z.string().cuid2(),
  responded: z.boolean(),
});

export type TJSWebsiteStateDisplay = z.infer<typeof ZJSWebsiteStateDisplay>;

export const ZJsAppStateSync = z.object({
  person: ZJsPerson.nullish(),
  userId: z.string().optional(),
  surveys: z.array(ZSurvey),
  actionClasses: z.array(ZActionClass),
  product: ZProduct,
  language: z.string().optional(),
});

export type TJsAppStateSync = z.infer<typeof ZJsAppStateSync>;

export const ZJsAppState = z.object({
  attributes: ZAttributes,
  surveys: z.array(ZSurvey),
  actionClasses: z.array(ZActionClass),
  product: ZProduct,
});

export type TJsAppState = z.infer<typeof ZJsAppState>;

export const ZJsAppConfigUpdateInput = z.object({
  environmentId: z.string().cuid2(),
  apiHost: z.string(),
  userId: z.string(),
  state: ZJsAppState,
  expiresAt: z.date(),
  status: z.enum(["success", "error"]).optional(),
});

export type TJsAppConfigUpdateInput = z.infer<typeof ZJsAppConfigUpdateInput>;

export const ZJsRNConfig = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  userId: z.string(),
  state: ZJsAppState,
  expiresAt: z.date(),
  status: z.enum(["success", "error"]).optional(),
});

export type TJsRNConfig = z.infer<typeof ZJsRNConfig>;

export const ZJsWebsiteStateSync = ZJsAppStateSync.omit({ person: true });

export type TJsWebsiteStateSync = z.infer<typeof ZJsWebsiteStateSync>;

export const ZJsRNSyncParams = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  userId: z.string(),
  attributes: ZAttributes.optional(),
});

export type TJsRNSyncParams = z.infer<typeof ZJsRNSyncParams>;

export const ZJsWebsiteState = z.object({
  surveys: z.array(ZSurvey),
  actionClasses: z.array(ZActionClass),
  product: ZProduct,
  displays: z.array(ZJSWebsiteStateDisplay),
  attributes: ZAttributes.optional(),
});

export type TJsWebsiteState = z.infer<typeof ZJsWebsiteState>;

export const ZJsEnvironmentState = z.object({
  expiresAt: z.date(),
  data: z.object({
    surveys: z.array(ZSurvey),
    actionClasses: z.array(ZActionClass),
    product: ZProduct,
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
    attributes: ZAttributes,
    lastDisplayAt: z.date().nullable(),
  }),
});

export type TJsPersonState = z.infer<typeof ZJsPersonState>;

export const ZJsPersonIdentifyInput = z.object({
  environmentId: z.string().cuid(),
  userId: z.string().optional(),
});

export type TJsPersonIdentifyInput = z.infer<typeof ZJsPersonIdentifyInput>;

export const ZJsConfig = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  environmentState: ZJsEnvironmentState,
  personState: ZJsPersonState,
  filteredSurveys: z.array(ZSurvey).default([]),
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

export const ZJsWebsiteConfigInput = z.object({
  environmentId: z.string().cuid2(),
  apiHost: z.string(),
  errorHandler: z.function().args(z.any()).returns(z.void()).optional(),
  attributes: z.record(z.string()).optional(),
});

export type TJsWebsiteConfigInput = z.infer<typeof ZJsWebsiteConfigInput>;

export const ZJsConfigInput = z.object({
  environmentId: z.string().cuid2(),
  apiHost: z.string(),
  errorHandler: z.function().args(z.any()).returns(z.void()).optional(),
  userId: z.string().optional(),
  attributes: z.record(z.string()).optional(),
});

export type TJsConfigInput = z.infer<typeof ZJsConfigInput>;

export const ZJsReactNativeConfigInput = ZJsConfigInput.omit({ userId: true }).extend({ userId: z.string() });
export type TJsReactNativeConfigInput = z.infer<typeof ZJsReactNativeConfigInput>;

export const ZJsPeopleUserIdInput = z.object({
  environmentId: z.string().cuid2(),
  userId: z.string().min(1).max(255),
});

export const ZJsPeopleUpdateAttributeInput = z.object({
  attributes: ZAttributes,
});

export type TJsPeopleUpdateAttributeInput = z.infer<typeof ZJsPeopleUpdateAttributeInput>;

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
