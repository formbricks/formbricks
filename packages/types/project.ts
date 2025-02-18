import { z } from "zod";
import { ZColor, ZPlacement } from "./common";
import { ZEnvironment } from "./environment";
import { ZBaseStyling } from "./styling";

export const ZProjectStyling = ZBaseStyling.extend({
  allowStyleOverwrite: z.boolean(),
});

export type TProjectStyling = z.infer<typeof ZProjectStyling>;

export const ZProjectConfigIndustry = z.enum(["eCommerce", "saas", "other"]).nullable();
export type TProjectConfigIndustry = z.infer<typeof ZProjectConfigIndustry>;

export const ZProjectConfigChannel = z.enum(["link", "app", "website"]).nullable();
export type TProjectConfigChannel = z.infer<typeof ZProjectConfigChannel>;

export const ZProjectMode = z.enum(["surveys", "cx"]);
export type TProjectMode = z.infer<typeof ZProjectMode>;

export const ZProjectConfig = z.object({
  channel: ZProjectConfigChannel,
  industry: ZProjectConfigIndustry,
});

export type TProjectConfig = z.infer<typeof ZProjectConfig>;

export const ZLanguage = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  code: z.string(),
  alias: z.string().nullable(),
  projectId: z.string().cuid2(),
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

export const ZLogo = z.object({
  url: z.string().optional(),
  bgColor: z.string().optional(),
});

export type TLogo = z.infer<typeof ZLogo>;

export const ZProject = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string().trim().min(1, { message: "Project name cannot be empty" }),
  organizationId: z.string(),
  styling: ZProjectStyling,
  recontactDays: z
    .number({ message: "Recontact days is required" })
    .int()
    .min(0, { message: "Must be a positive number" })
    .max(365, { message: "Must be less than 365" }),
  inAppSurveyBranding: z.boolean(),
  linkSurveyBranding: z.boolean(),
  config: ZProjectConfig,
  placement: ZPlacement,
  clickOutsideClose: z.boolean(),
  darkOverlay: z.boolean(),
  environments: z.array(ZEnvironment),
  languages: z.array(ZLanguage),
  logo: ZLogo.nullish(),
});

export type TProject = z.infer<typeof ZProject>;

export const ZProjectUpdateInput = z.object({
  name: z.string().trim().min(1, { message: "Project name cannot be empty" }).optional(),
  organizationId: z.string().optional(),
  highlightBorderColor: ZColor.nullish(),
  recontactDays: z.number().int().optional(),
  inAppSurveyBranding: z.boolean().optional(),
  linkSurveyBranding: z.boolean().optional(),
  config: ZProjectConfig.optional(),
  placement: ZPlacement.optional(),
  clickOutsideClose: z.boolean().optional(),
  darkOverlay: z.boolean().optional(),
  environments: z.array(ZEnvironment).optional(),
  styling: ZProjectStyling.optional(),
  logo: ZLogo.optional(),
  teamIds: z.array(z.string()).optional(),
});

export type TProjectUpdateInput = z.infer<typeof ZProjectUpdateInput>;
