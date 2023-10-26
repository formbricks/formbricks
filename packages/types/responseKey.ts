import z from "zod";

export const ZResponseKeyId = z.string().length(10);

export type TResponseKeyId = z.infer<typeof ZResponseKeyId>;

export const ZResponseKey = z.object({
  id: ZResponseKeyId,
  createdAt: z.date(),
  surveyId: z.string().cuid2(),
});

export type TResponseKey = z.infer<typeof ZResponseKey>;
