import { z } from "zod";

import { ZColor, ZPlacement } from "./common";
import { ZEnvironment } from "./environment";

export const ZLanguages = z.record(z.string());

export type TLanguages = z.infer<typeof ZLanguages>;

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
  languages: ZLanguages,
});

export type TProduct = z.infer<typeof ZProduct>;

export const ZProductUpdateInput = ZProduct.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TProductUpdateInput = z.infer<typeof ZProductUpdateInput>;
