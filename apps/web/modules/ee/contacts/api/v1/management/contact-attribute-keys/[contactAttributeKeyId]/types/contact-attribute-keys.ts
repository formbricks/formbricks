import { z } from "zod";

export const ZContactAttributeKeyCreateInput = z.object({
  key: z.string(),
  description: z.string().optional(),
  type: z.enum(["custom"]),
  environmentId: z.string(),
  name: z.string().optional(),
});
export type TContactAttributeKeyCreateInput = z.infer<typeof ZContactAttributeKeyCreateInput>;

export const ZContactAttributeKeyUpdateInput = z.object({
  description: z.string().optional(),
  name: z.string().optional(),
});

export type TContactAttributeKeyUpdateInput = z.infer<typeof ZContactAttributeKeyUpdateInput>;
