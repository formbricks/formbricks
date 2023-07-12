import z from "zod";

export const ZSession = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date(),
  personId: z.string().cuid2(),
});

export type TSession = z.infer<typeof ZSession>;
