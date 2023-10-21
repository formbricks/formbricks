import { z } from "zod";

export const ZTag = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  environmentId: z.string(),
});
export type TTag = z.infer<typeof ZTag>;

export const ZTagsCount = z.array(
  z.object({
    tagId: z.string().cuid2(),
    count: z.number(),
  })
);
export type TTagsCount = z.infer<typeof ZTagsCount>;

export const ZTagsOnResponses = z.object({
  responseId: z.string(),
  tagId: z.string(),
});
export type TTagsOnResponses = z.infer<typeof ZTagsOnResponses>;
