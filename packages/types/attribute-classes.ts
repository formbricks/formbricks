import { z } from "zod";

export const ZAttributeClassType = z.enum(["code", "noCode", "automatic"]);

export type TAttributeClassType = z.infer<typeof ZAttributeClassType>;

export const ZAttributeClass = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  description: z.string().nullable(),
  type: ZAttributeClassType,
  environmentId: z.string(),
  archived: z.boolean(),
});

export const ZAttributeClassInput = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(["code"]),
  environmentId: z.string(),
});

export const ZAttributeClassAutomaticInput = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(["automatic"]),
});

export const ZAttributeClassUpdateInput = z.object({
  name: z.string(),
  description: z.string().optional(),
  archived: z.boolean().optional(),
});

export type TAttributeClassAutomaticInput = z.infer<typeof ZAttributeClassAutomaticInput>;

export type TAttributeClassUpdateInput = z.infer<typeof ZAttributeClassUpdateInput>;

export type TAttributeClassInput = z.infer<typeof ZAttributeClassInput>;

export type TAttributeClass = z.infer<typeof ZAttributeClass>;
