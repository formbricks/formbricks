import { z } from "zod";

export const ZShortUrlId = z.string().length(10);

export type TShortUrlId = z.infer<typeof ZShortUrlId>;

export const ZShortUrl = z.object({
  id: ZShortUrlId,
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string().url(),
});

export type TShortUrl = z.infer<typeof ZShortUrl>;
