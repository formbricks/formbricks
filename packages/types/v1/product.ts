import { z } from "zod";

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
});

export type TProduct = z.infer<typeof ZProduct>;

export const ZProductLookAndFeelInput = z.object({
  brandColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  placement: z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]),
  highlightBorderColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .nullish(),
  formbricksSignature: z.boolean(),
  darkOverlay: z.boolean(),
  clickOutsideClose: z.boolean(),
});

export type TProductLookAndFeelInput = z.infer<typeof ZProductLookAndFeelInput>;
