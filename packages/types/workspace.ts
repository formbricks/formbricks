import { z } from "zod";
import { ZColor, ZOverlay, ZPlacement } from "./common";
import { ZEnvironment } from "./environment";
import { ZBaseStyling, ZLogo } from "./styling";

export const ZWorkspaceStyling = ZBaseStyling.extend({
  allowStyleOverwrite: z.boolean(),
});

export type TWorkspaceStyling = z.infer<typeof ZWorkspaceStyling>;

export const ZWorkspaceConfigIndustry = z.enum(["eCommerce", "saas", "other"]).nullable();
export type TWorkspaceConfigIndustry = z.infer<typeof ZWorkspaceConfigIndustry>;

export const ZWorkspaceConfigChannel = z.enum(["link", "app", "website"]).nullable();
export type TWorkspaceConfigChannel = z.infer<typeof ZWorkspaceConfigChannel>;

export const ZWorkspaceMode = z.enum(["surveys", "cx"]);
export type TWorkspaceMode = z.infer<typeof ZWorkspaceMode>;

export const ZWorkspaceConfig = z.object({
  channel: ZWorkspaceConfigChannel.optional(),
  industry: ZWorkspaceConfigIndustry.optional(),
});

export type TWorkspaceConfig = z.infer<typeof ZWorkspaceConfig>;

export const ZLanguage = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  code: z.string(),
  alias: z.string().nullable(),
  workspaceId: z.cuid2(),
});
export type TLanguage = z.infer<typeof ZLanguage>;

export const ZLanguageInput = z.object({
  code: z.string(),
  alias: z.string().nullable(),
});
export type TLanguageInput = z.infer<typeof ZLanguageInput>;

export const ZLanguageUpdate = z.object({
  alias: z.string().nullable(),
});
export type TLanguageUpdate = z.infer<typeof ZLanguageUpdate>;

export type TLogo = z.infer<typeof ZLogo>;

export const ZWorkspace = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string().trim().min(1, {
    error: "Workspace name cannot be empty",
  }),
  organizationId: z.string(),
  styling: ZWorkspaceStyling,
  recontactDays: z
    .int()
    .min(0, {
      error: "Must be a positive number",
    })
    .max(365, {
      error: "Must be less than 365",
    }),
  inAppSurveyBranding: z.boolean(),
  linkSurveyBranding: z.boolean(),
  config: ZWorkspaceConfig,
  placement: ZPlacement,
  clickOutsideClose: z.boolean(),
  overlay: ZOverlay,
  environments: z.array(ZEnvironment),
  languages: z.array(ZLanguage),
  logo: ZLogo.nullish(),
  customHeadScripts: z.string().nullish(),
});

export type TWorkspace = z.infer<typeof ZWorkspace>;

export const ZWorkspaceUpdateInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, {
      error: "Workspace name cannot be empty",
    })
    .optional(),
  organizationId: z.string().optional(),
  highlightBorderColor: ZColor.nullish(),
  recontactDays: z.int().optional(),
  inAppSurveyBranding: z.boolean().optional(),
  linkSurveyBranding: z.boolean().optional(),
  config: ZWorkspaceConfig.optional(),
  placement: ZPlacement.optional(),
  clickOutsideClose: z.boolean().optional(),
  overlay: ZOverlay.optional(),
  environments: z.array(ZEnvironment).optional(),
  styling: ZWorkspaceStyling.optional(),
  logo: ZLogo.optional(),
  teamIds: z.array(z.string()).optional(),
  customHeadScripts: z.string().nullish(),
});

export type TWorkspaceUpdateInput = z.infer<typeof ZWorkspaceUpdateInput>;
