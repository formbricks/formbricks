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

export type TAttributeClass = z.infer<typeof ZAttributeClass>;
