import { z } from "zod";

export const ZOrganizationBilling = z.object({
  stripeCustomerId: z.string().nullable(),
  plan: z.enum(["free", "startup", "scale", "enterprise"]).default("free"),
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
  name: z.string(),
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
