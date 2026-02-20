import type { Organization } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZOrganizationWhiteLabel = z.object({
  logoUrl: z.string().nullable(),
});

export const ZOrganizationBilling = z.object({
  stripeCustomerId: z.string().nullable(),
  billingMode: z.enum(["stripe", "legacy"]).optional().default("stripe"),
  plan: z.enum(["free", "startup", "scale", "enterprise"]).default("free"),
  period: z.enum(["monthly", "yearly"]).default("monthly"),
  limits: z
    .object({
      projects: z.number().nullable(),
      monthly: z.object({
        responses: z.number().nullable(),
        miu: z.number().nullable(),
      }),
    })
    .default({
      projects: 3,
      monthly: {
        responses: 1500,
        miu: 2000,
      },
    }),
  periodStart: z.coerce.date().nullable(),
  stripe: z
    .object({
      billingMode: z.enum(["stripe", "legacy"]).optional(),
      plan: z.enum(["hobby", "pro", "scale", "trial", "unknown"]).optional(),
      subscriptionId: z.string().nullable().optional(),
      features: z.array(z.string()).optional(),
      lastStripeEventCreatedAt: z.string().nullable().optional(),
      lastSyncedAt: z.string().nullable().optional(),
      lastSyncedEventId: z.string().nullable().optional(),
    })
    .optional(),
});

export const ZOrganization = z.object({
  id: z.string().cuid2(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string(),
  whitelabel: ZOrganizationWhiteLabel,
  billing: ZOrganizationBilling as z.ZodType<Organization["billing"]>,
  isAIEnabled: z.boolean().default(false) as z.ZodType<Organization["isAIEnabled"]>,
}) satisfies z.ZodType<Organization>;
