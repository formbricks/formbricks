import { z } from "zod";
import { ZEnvironment } from "./environment";

export const ZProduct = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  teamId: z.string(),
  brandColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  highlightBorderColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .nullish(),
  recontactDays: z.number().int(),
  formbricksSignature: z.boolean(),
  placement: z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]),
  clickOutsideClose: z.boolean(),
  darkOverlay: z.boolean(),
  environments: z.array(ZEnvironment),
});

export type TProduct = z.infer<typeof ZProduct>;

export const ZProductUpdateInput = ZProduct.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  environments: true,
});

export type TProductUpdateInput = z.infer<typeof ZProductUpdateInput>;
