import { z } from "zod";

export const ZTeam = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  plan: z.enum(["free", "pro"]),
  stripeCustomerId: z.string().nullable(),
});

export const ZTeamUpdateInput = z.object({
  name: z.string(),
  plan: z.enum(["free", "pro"]).optional(),
  stripeCustomerId: z.string().nullish(),
});

export type TTeamUpdateInput = z.infer<typeof ZTeamUpdateInput>;

export type TTeam = z.infer<typeof ZTeam>;
