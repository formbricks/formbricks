import z from "zod";

export const ZAttributeClass = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["code", "noCode", "automatic"]),
  environmentId: z.string(),
  archived: z.boolean(),
});

export const ZAttributeClassUpdateInput = z.object({
  description: z.string(),
  archived: z.boolean(),
});
export type TAttributeClassUpdateInput = z.infer<typeof ZAttributeClassUpdateInput>;

export type TAttributeClass = z.infer<typeof ZAttributeClass>;
