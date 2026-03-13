import { z } from "zod";
import { ZStorageUrl } from "./common";

export const ZCloudBillingPlan = z.enum(["hobby", "pro", "scale", "custom", "unknown"]);
export type TCloudBillingPlan = z.infer<typeof ZCloudBillingPlan>;
export const ZOrganizationStripeSubscriptionStatus = z.enum([
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "paused",
  "canceled",
  "incomplete",
  "incomplete_expired",
]);
export type TOrganizationStripeSubscriptionStatus = z.infer<typeof ZOrganizationStripeSubscriptionStatus>;

export const ZOrganizationStripeBilling = z.object({
  plan: ZCloudBillingPlan.optional(),
  subscriptionStatus: ZOrganizationStripeSubscriptionStatus.nullable().optional(),
  subscriptionId: z.string().nullable().optional(),
  hasPaymentMethod: z.boolean().optional(),
  features: z.array(z.string()).optional(),
  lastStripeEventCreatedAt: z.string().nullable().optional(),
  lastSyncedAt: z.string().nullable().optional(),
  lastSyncedEventId: z.string().nullable().optional(),
  trialEnd: z.string().nullable().optional(),
});
export type TOrganizationStripeBilling = z.infer<typeof ZOrganizationStripeBilling>;

// responses can be null to support the unlimited plan
export const ZOrganizationBillingPlanLimits = z.object({
  projects: z.number().nullable(),
  monthly: z.object({
    responses: z.number().nullable(),
  }),
});

export type TOrganizationBillingPlanLimits = z.infer<typeof ZOrganizationBillingPlanLimits>;

export const ZOrganizationBilling = z.object({
  stripeCustomerId: z.string().nullable(),
  limits: ZOrganizationBillingPlanLimits.default({
    projects: 3,
    monthly: {
      responses: 1500,
    },
  }),
  usageCycleAnchor: z.date().nullable(),
  stripe: ZOrganizationStripeBilling.optional(),
});

export type TOrganizationBilling = z.infer<typeof ZOrganizationBilling>;

export const ZOrganizationWhitelabel = z.object({
  logoUrl: ZStorageUrl.nullable(),
  faviconUrl: ZStorageUrl.nullish(),
});

export type TOrganizationWhitelabel = z.infer<typeof ZOrganizationWhitelabel>;

export const ZOrganization = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z
    .string({
      error: "Organization name is required",
    })
    .trim()
    .min(1, {
      error: "Organization name must be at least 1 character long",
    }),
  whitelabel: ZOrganizationWhitelabel.optional(),
  billing: ZOrganizationBilling,
  isAIEnabled: z.boolean().prefault(false),
});

export const ZOrganizationCreateInput = z.object({
  id: z.cuid2().optional(),
  name: z.string(),
});

export type TOrganizationCreateInput = z.infer<typeof ZOrganizationCreateInput>;

export const ZOrganizationUpdateInput = z.object({
  name: z.string(),
  whitelabel: ZOrganizationWhitelabel.optional(),
  billing: ZOrganizationBilling.optional(),
  isAIEnabled: z.boolean().optional(),
});

export type TOrganizationUpdateInput = z.infer<typeof ZOrganizationUpdateInput>;

export type TOrganization = z.infer<typeof ZOrganization>;
