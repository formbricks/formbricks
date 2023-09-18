import { z } from "zod";
import { Prisma } from "@prisma/client";

export const ZTeam = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  plan: z.enum(["free", "pro"]),
  stripeCustomerId: z.string().nullable(),
});

export type TTeamUpdateInput = Prisma.TeamUpdateInput;

export type TTeam = z.infer<typeof ZTeam>;
