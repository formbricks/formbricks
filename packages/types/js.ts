import z from "zod";

import { ZLegacySurvey } from "./LegacySurvey";
import { ZActionClass } from "./actionClasses";
import { ZPerson, ZPersonAttributes, ZPersonClient } from "./people";
import { ZProduct } from "./product";
import { ZSurvey } from "./surveys";

const ZSurveyWithTriggers = ZSurvey.extend({
  triggers: z.array(ZActionClass).or(z.array(z.string())),
});

export type TSurveyWithTriggers = z.infer<typeof ZSurveyWithTriggers>;

export const ZJSWebsiteStateDisplay = z.object({
  createdAt: z.date(),
  surveyId: z.string().cuid(),
  responded: z.boolean(),
});

export type TJSWebsiteStateDisplay = z.infer<typeof ZJSWebsiteStateDisplay>;

export const ZJsInAppStateSync = z.object({
  person: ZPersonClient.nullish(),
  surveys: z.union([z.array(ZSurvey), z.array(ZLegacySurvey)]),
  noCodeActionClasses: z.array(ZActionClass),
  product: ZProduct,
});

export type TJsInAppStateSync = z.infer<typeof ZJsInAppStateSync>;

export const ZJsWebsiteStateSync = ZJsInAppStateSync.omit({ person: true });

export type TJsWebsiteStateSync = z.infer<typeof ZJsWebsiteStateSync>;

export const ZJsInAppState = z.object({
  attributes: ZPersonAttributes,
  surveys: z.array(ZSurvey),
  noCodeActionClasses: z.array(ZActionClass),
  product: ZProduct,
});

export type TJsInAppState = z.infer<typeof ZJsInAppState>;

export const ZJsWebsiteState = z.object({
  surveys: z.array(ZSurvey),
  noCodeActionClasses: z.array(ZActionClass),
  product: ZProduct,
  displays: z.array(ZJSWebsiteStateDisplay),
  attributes: ZPersonAttributes.optional(),
});

export type TJsWebsiteState = z.infer<typeof ZJsWebsiteState>;

export const ZJsLegacyState = z.object({
  person: ZPerson.nullable().or(z.object({})),
  session: z.object({}),
  surveys: z.array(ZSurveyWithTriggers),
  noCodeActionClasses: z.array(ZActionClass),
  product: ZProduct,
  displays: z.array(ZJSWebsiteStateDisplay).optional(),
});

export type TJsLegacyState = z.infer<typeof ZJsLegacyState>;

export const ZJsWebsiteSyncInput = z.object({
  environmentId: z.string().cuid(),
  version: z.string().optional(),
});

export type TJsWebsiteSyncInput = z.infer<typeof ZJsWebsiteSyncInput>;

export const ZJsSyncLegacyInput = z.object({
  environmentId: z.string().cuid(),
  personId: z.string().cuid().optional().or(z.literal("legacy")),
  sessionId: z.string().cuid().optional(),
  jsVersion: z.string().optional(),
});

export type TJsSyncLegacyInput = z.infer<typeof ZJsSyncLegacyInput>;

export const ZJsWebsiteConfig = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  state: ZJsWebsiteState,
  expiresAt: z.date(),
  status: z.enum(["success", "error"]).optional(),
});

export type TJsWebsiteConfig = z.infer<typeof ZJsWebsiteConfig>;

export const ZJSInAppConfig = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  userId: z.string(),
  state: ZJsInAppState,
  expiresAt: z.date(),
  status: z.enum(["success", "error"]).optional(),
});

export type TJSInAppConfig = z.infer<typeof ZJSInAppConfig>;

export const ZJsWebsiteConfigUpdateInput = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  state: ZJsWebsiteState,
  expiresAt: z.date(),
  status: z.enum(["success", "error"]).optional(),
});

export type TJsWebsiteConfigUpdateInput = z.infer<typeof ZJsWebsiteConfigUpdateInput>;

export const ZJsInAppConfigUpdateInput = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  userId: z.string(),
  state: ZJsInAppState,
  expiresAt: z.date(),
  status: z.enum(["success", "error"]).optional(),
});

export type TJsInAppConfigUpdateInput = z.infer<typeof ZJsInAppConfigUpdateInput>;

export const ZJsWebsiteConfigInput = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  errorHandler: z.function().args(z.any()).returns(z.void()).optional(),
  attributes: ZPersonAttributes.optional(),
});

export type TJsWebsiteConfigInput = z.infer<typeof ZJsWebsiteConfigInput>;

export const ZJsInAppConfigInput = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  errorHandler: z.function().args(z.any()).returns(z.void()).optional(),
  userId: z.string(),
  attributes: ZPersonAttributes.optional(),
});

export type TJsInAppConfigInput = z.infer<typeof ZJsInAppConfigInput>;

export const ZJsPeopleUserIdInput = z.object({
  environmentId: z.string().cuid(),
  userId: z.string().min(1).max(255),
  version: z.string().optional(),
});

export type TJsPeopleUserIdInput = z.infer<typeof ZJsPeopleUserIdInput>;

export const ZJsPeopleAttributeInput = z.object({
  key: z.string(),
  value: z.string(),
});

export type TJsPeopleAttributeInput = z.infer<typeof ZJsPeopleAttributeInput>;

export const ZJsPeopleLegacyAttributeInput = z.object({
  environmentId: z.string().cuid(),
  key: z.string(),
  value: z.string(),
});

export type TJsPeopleLegacyAttributeInput = z.infer<typeof ZJsPeopleLegacyAttributeInput>;

export const ZJsActionInput = z.object({
  environmentId: z.string().cuid(),
  userId: z.string().optional(),
  name: z.string(),
});

export type TJsActionInput = z.infer<typeof ZJsActionInput>;

export const ZJsWesbiteActionInput = ZJsActionInput.omit({ userId: true });

export type TJsWesbiteActionInput = z.infer<typeof ZJsWesbiteActionInput>;

export const ZJSInAppSyncParams = z.object({
  environmentId: z.string().cuid(),
  apiHost: z.string(),
  userId: z.string(),
});

export type TJsInAppSyncParams = z.infer<typeof ZJSInAppSyncParams>;

export const ZJsWebsiteSyncParams = ZJSInAppSyncParams.omit({ userId: true });

export type TJsWebsiteSyncParams = z.infer<typeof ZJsWebsiteSyncParams>;

const ZJsSettingsSurvey = ZSurvey.pick({
  id: true,
  welcomeCard: true,
  questions: true,
  triggers: true,
  thankYouCard: true,
  autoClose: true,
  delay: true,
});

export const ZJsSettings = z.object({
  surveys: z.optional(z.array(ZJsSettingsSurvey)),
  noCodeEvents: z.optional(z.array(z.any())), // You might want to further refine this.
  brandColor: z.optional(z.string()),
  formbricksSignature: z.optional(z.boolean()),
  placement: z.optional(
    z.union([
      z.literal("bottomLeft"),
      z.literal("bottomRight"),
      z.literal("topLeft"),
      z.literal("topRight"),
      z.literal("center"),
    ])
  ),
  clickOutsideClose: z.optional(z.boolean()),
  darkOverlay: z.optional(z.boolean()),
});

export type TSettings = z.infer<typeof ZJsSettings>;

export const ZJsPackageType = z.union([z.literal("in-app"), z.literal("website")]);

export type TJsPackageType = z.infer<typeof ZJsPackageType>;
