import type { Organization, OrganizationBilling } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZOrganizationWhiteLabel = z.object({
  logoUrl: z.string().nullable(),
});

export const ZOrganizationBilling = z.object({
  organizationId: z.string().cuid2(),
  stripeCustomerId: z.string().nullable(),
  limits: z
    .object({
      projects: z.number().nullable(),
      monthly: z.object({
        responses: z.number().nullable(),
        miu: z.number().nullable(),
      }),
    })
    .prefault({
      projects: 3,
      monthly: {
        responses: 1500,
        miu: 2000,
      },
    }),
  periodStart: z.coerce.date(),
  stripe: z
    .object({
      responseMetering: z
        .object({
          usagePriceId: z.string().nullable().optional(),
          includedResponses: z.number().nullable().optional(),
          overageUnitAmountCents: z.number().nullable().optional(),
          currency: z.string().nullable().optional(),
        })
        .optional(),
      plan: z.enum(["hobby", "pro", "scale", "trial", "unknown"]).optional(),
      subscriptionId: z.string().nullable().optional(),
      features: z.array(z.string()).optional(),
      lastStripeEventCreatedAt: z.string().nullable().optional(),
      lastSyncedAt: z.string().nullable().optional(),
      lastSyncedEventId: z.string().nullable().optional(),
    })
    .optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}) satisfies z.ZodType<OrganizationBilling>;

export const ZOrganization = z.object({
  id: z.string().cuid2(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string(),
  whitelabel: ZOrganizationWhiteLabel,
  isAIEnabled: z.boolean().default(false) as z.ZodType<Organization["isAIEnabled"]>,
}) satisfies z.ZodType<Organization>;
