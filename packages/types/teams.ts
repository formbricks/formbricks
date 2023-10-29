import { z } from "zod";

export const ZSubscription = z.object({
  status: z.enum(["active", "cancelled", "inactive"]).default("inactive"),
});

export type TSubscription = z.infer<typeof ZSubscription>;

export const ZTeamBilling = z.object({
  stripeCustomerId: z.string().nullable(),
  features: z.object({
    appSurvey: ZSubscription,
    linkSurvey: ZSubscription,
    userTargeting: ZSubscription,
  }),
});

export type TTeamBilling = z.infer<typeof ZTeamBilling>;

export const ZTeam = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  billing: ZTeamBilling,
});

export const ZTeamUpdateInput = z.object({
  name: z.string(),
  billing: ZTeamBilling.optional(),
});

export type TTeamUpdateInput = z.infer<typeof ZTeamUpdateInput>;

export type TTeam = z.infer<typeof ZTeam>;
