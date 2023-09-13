import z from "zod";

export const ZProfile = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  onboardingCompleted: z.boolean(),
});

export type TProfile = z.infer<typeof ZProfile>;

export const ZProfileUpdateInput = z.object({
  name: z.string().nullable(),
  email: z.string().optional(),
  onboardingCompleted: z.boolean(),
});

export type TProfileUpdateInput = z.infer<typeof ZProfileUpdateInput>;
