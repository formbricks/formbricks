import z from "zod";

export const ZProfile = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  twoFactorEnabled: z.boolean(),
  identityProvider: z.enum(["email", "google", "github"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TProfile = z.infer<typeof ZProfile>;

export const ZProfileUpdateInput = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
});

export type TProfileUpdateInput = z.infer<typeof ZProfileUpdateInput>;
