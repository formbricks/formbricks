import { z } from "zod";

export type TTag = z.infer<typeof ZTag>;

export const ZTag = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  productId: z.string(),
});
