import { z } from "zod";

export const ZSubscription = z.object({
  status: z.enum(["active", "cancelled", "inactive"]).default("inactive"),
  unlimited: z.boolean().default(false),
});

export type TSubscription = z.infer<typeof ZSubscription>;

export const ZTeamBilling = z.object({
  stripeCustomerId: z.string().nullable(),
  features: z.object({
    inAppSurvey: ZSubscription,
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

export const ZTeamCreateInput = z.object({
  id: z.string().cuid2().optional(),
  name: z.string(),
  billing: ZTeamBilling.optional(),
});

export type TTeamCreateInput = z.infer<typeof ZTeamCreateInput>;

export const ZTeamUpdateInput = z.object({
  name: z.string(),
  billing: ZTeamBilling.optional(),
});

export type TTeamUpdateInput = z.infer<typeof ZTeamUpdateInput>;

export type TTeam = z.infer<typeof ZTeam>;
