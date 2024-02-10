import { z } from "zod";

import { ZColor, ZPlacement } from "./common";
import { ZEnvironment } from "./environment";

export const ZProduct = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  teamId: z.string(),
  brandColor: ZColor,
  highlightBorderColor: ZColor.nullable(),
  recontactDays: z.number().int(),
  inAppSurveyBranding: z.boolean(),
  linkSurveyBranding: z.boolean(),
  placement: ZPlacement,
  clickOutsideClose: z.boolean(),
  darkOverlay: z.boolean(),
  environments: z.array(ZEnvironment),
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
});

export type TProductUpdateInput = z.infer<typeof ZProductUpdateInput>;
