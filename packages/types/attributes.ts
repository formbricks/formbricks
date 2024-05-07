import { z } from "zod";

export const ZAttributeUpdateInput = z.object({
  environmentId: z.string().cuid2(),
  userId: z.string(),
  attributes: z.record(z.string()),
});

export type TAttributeUpdateInput = z.infer<typeof ZAttributeUpdateInput>;

export const ZAttributes = z.record(z.string());
export type TAttributes = z.infer<typeof ZAttributes>;
