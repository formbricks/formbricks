import { z } from "zod";
import { ZEnvironment } from "./environment";
import { ZColor, ZSurveyPlacement } from "./common";

export const ZProduct = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  teamId: z.string(),
  brandColor: ZColor,
  highlightBorderColor: ZColor.nullable(),
  recontactDays: z.number().int(),
  formbricksSignature: z.boolean(),
  placement: ZSurveyPlacement,
  clickOutsideClose: z.boolean(),
  darkOverlay: z.boolean(),
  environments: z.array(ZEnvironment),
});

export type TProduct = z.infer<typeof ZProduct>;

export const ZProductUpdateInput = ZProduct.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TProductUpdateInput = z.infer<typeof ZProductUpdateInput>;
