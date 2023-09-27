import { z } from "zod";
import { Prisma } from "@prisma/client";

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

export type TTeamUpdateInput = Prisma.TeamUpdateInput;

export type TTeam = z.infer<typeof ZTeam>;
