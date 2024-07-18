import { z } from "zod";

export const ZPerson = z.object({
  id: z.string().cuid2(),
  userId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: z.string().cuid2(),
});

export type TPerson = z.infer<typeof ZPerson>;
