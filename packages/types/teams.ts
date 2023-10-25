import { z } from "zod";

export const ZTeamSubscription = z.object({
  stripeCustomerId: z.string().nullable(),
  plan: z.enum(["community", "scale"]),
  addOns: z.array(z.enum(["removeBranding", "customUrl"])),
});

export type TTeamSubscription = z.infer<typeof ZTeamSubscription>;

export const ZTeam = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  subscription: ZTeamSubscription,
});

export const ZTeamUpdateInput = z.object({
  name: z.string(),
  plan: z.enum(["free", "pro"]).optional(),
  stripeCustomerId: z.string().nullish(),
});

export type TTeamUpdateInput = z.infer<typeof ZTeamUpdateInput>;

export type TTeam = z.infer<typeof ZTeam>;
