import { z } from "zod";

export type TTag = z.infer<typeof ZTag>;

export const ZTag = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  environmentId: z.string(),
});

export type TTagsCount = z.infer<typeof ZTagsCount>;

export const ZTagsCount = z.array(
  z.object({
    tagId: z.string().cuid2(),
    _count: z.object({
      _all: z.number(),
    }),
  })
);
