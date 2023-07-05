import { z } from "zod";

export const ZProduct = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  teamId: z.string(),
  brandColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  recontactDays: z.number().int(),
  formbricksSignature: z.boolean(),
  placement: z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]),
  clickOutsideClose: z.boolean(),
  darkOverlay: z.boolean(),
});

export const _ZEnvironmentProduct = z
  .object({
    id: ZProduct.shape.id,
    name: ZProduct.shape.name,
    team: ZProduct.shape.teamId,
    brandColor: ZProduct.shape.brandColor,
  })
  .partial();

const _ZEnvironmentIdentifer = z.object({
  id: z.string().cuid2(),
  type: z.enum(["development", "production"]),
});

export const ZProductWithEnvironment = ZProduct.extend({
  environments: z.array(_ZEnvironmentIdentifer),
});

export type TProduct = z.infer<typeof ZProduct>;
export type TProductWithEnvironmentIds = z.infer<typeof ZProductWithEnvironment>;
