import z from "zod";

export const ZResultShareUrlId = z.string().length(10);

export type TResultShareUrlId = z.infer<typeof ZResultShareUrlId>;

export const ZResultShareUrl = z.object({
  id: ZResultShareUrlId,
  createdAt: z.date(),
  surveyId: z.string().cuid2(),
});

export type TResultShareUrl = z.infer<typeof ZResultShareUrl>;
