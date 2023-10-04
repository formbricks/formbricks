import z from "zod";

export const ZShortUrl = z.object({
  id: z.string().length(10),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string().url(),
});

export type TShortUrl = z.infer<typeof ZShortUrl>;
