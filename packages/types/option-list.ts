import { z } from "zod";

export const ZOptionList = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string().min(1).max(100),
  options: z.array(z.string()),
  projectId: z.string().cuid2(),
});

export type TOptionList = z.infer<typeof ZOptionList>;

export const ZOptionListInput = z.object({
  name: z.string().min(1).max(100),
  options: z.array(z.string().min(1)).min(1),
});

export type TOptionListInput = z.infer<typeof ZOptionListInput>;
