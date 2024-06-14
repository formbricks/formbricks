import { z } from "zod";

export const ZSubscriptionStatus = z.enum(["active", "cancelled", "inactive"]).default("inactive");

export type TSubscriptionStatus = z.infer<typeof ZSubscriptionStatus>;

export const ZSubscription = z.object({
  status: ZSubscriptionStatus,
  unlimited: z.boolean().default(false),
});

export type TSubscription = z.infer<typeof ZSubscription>;

export const ZOrganizationBilling = z.object({
  stripeCustomerId: z.string().nullable(),
  features: z.object({
    inAppSurvey: ZSubscription,
    linkSurvey: ZSubscription,
    userTargeting: ZSubscription,
    multiLanguage: ZSubscription,
  }),
});

export type TOrganizationBilling = z.infer<typeof ZOrganizationBilling>;

export const ZOrganization = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string({ message: "Organization name is required" }).trim().min(1, {
    message: "Organization name must be at least 1 character long",
  }),
  billing: ZOrganizationBilling,
});

export const ZOrganizationCreateInput = z.object({
  id: z.string().cuid2().optional(),
  name: z.string(),
  billing: ZOrganizationBilling.optional(),
});

export type TOrganizationCreateInput = z.infer<typeof ZOrganizationCreateInput>;

export const ZOrganizationUpdateInput = z.object({
  name: z.string(),
  billing: ZOrganizationBilling.optional(),
});

export type TOrganizationUpdateInput = z.infer<typeof ZOrganizationUpdateInput>;

export type TOrganization = z.infer<typeof ZOrganization>;
