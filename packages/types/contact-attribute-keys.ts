import { z } from "zod";

export const ZContactAttributeKeyType = z.enum(["default", "custom"]);

export type TContactAttributeKeyType = z.infer<typeof ZContactAttributeKeyType>;

export const ZContactAttributeKey = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  isUnique: z.boolean().default(false),
  key: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  type: ZContactAttributeKeyType,
  environmentId: z.string(),
});

export const ZContactAttributeKeyInput = z.object({
  key: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["custom"]),
  environmentId: z.string(),
});

export const ZContactAttributeKeyUpdateInput = z.object({
  key: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export type TContactAttributeKeyUpdateInput = z.infer<typeof ZContactAttributeKeyUpdateInput>;

export type TContactAttributeKeyInput = z.infer<typeof ZContactAttributeKeyInput>;

export type TContactAttributeKey = z.infer<typeof ZContactAttributeKey>;
