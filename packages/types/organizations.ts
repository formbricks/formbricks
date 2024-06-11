import { z } from "zod";

export const ZOrganizationBillingPlan = z.enum(["free", "startup", "scale", "enterprise"]);
export type TOrganizationBillingPlan = z.infer<typeof ZOrganizationBillingPlan>;

export const ZOrganizationBillingPlanLimits = z.object({
  monthly: z.object({
    responses: z.number(),
    miu: z.number(),
  }),
});

export type TOrganizationBillingPlanLimits = z.infer<typeof ZOrganizationBillingPlanLimits>;

export const ZOrganizationBilling = z.object({
  stripeCustomerId: z.string().nullable(),
  plan: ZOrganizationBillingPlan.default("free"),
  limits: z.object({
    monthly: z.object({
      responses: z.number(),
      miu: z.number(),
    }),
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
