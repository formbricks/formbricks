import z from "zod";

export const ZProfile = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TProfile = z.infer<typeof ZProfile>;
