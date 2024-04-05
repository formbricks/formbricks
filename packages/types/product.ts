import { z } from "zod";

import { ZColor, ZPlacement } from "./common";
import { ZEnvironment } from "./environment";
import { ZBaseStyling } from "./styling";

export const ZProductStyling = ZBaseStyling.extend({
  allowStyleOverwrite: z.boolean(),
});

export type TProductStyling = z.infer<typeof ZProductStyling>;

export const ZLanguage = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  code: z.string(),
  alias: z.string().nullable(),
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

export const ZProduct = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  teamId: z.string(),
  styling: ZProductStyling,
  recontactDays: z.number().int(),
  inAppSurveyBranding: z.boolean(),
  linkSurveyBranding: z.boolean(),
  placement: ZPlacement,
  clickOutsideClose: z.boolean(),
  darkOverlay: z.boolean(),
  environments: z.array(ZEnvironment),
  brandColor: ZColor.nullish(),
  highlightBorderColor: ZColor.nullish(),
  languages: z.array(ZLanguage),
});

export type TProduct = z.infer<typeof ZProduct>;

export const ZProductUpdateInput = z.object({
  name: z.string().optional(),
  teamId: z.string().optional(),
  brandColor: ZColor.optional(),
  highlightBorderColor: ZColor.nullish(),
  recontactDays: z.number().int().optional(),
  inAppSurveyBranding: z.boolean().optional(),
  linkSurveyBranding: z.boolean().optional(),
  placement: ZPlacement.optional(),
  clickOutsideClose: z.boolean().optional(),
  darkOverlay: z.boolean().optional(),
  environments: z.array(ZEnvironment).optional(),
  styling: ZProductStyling.optional(),
});

export type TProductUpdateInput = z.infer<typeof ZProductUpdateInput>;
