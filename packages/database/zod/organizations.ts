import type { Organization } from "@prisma/client";
import { z } from "zod";

export const ZOrganizationWhiteLabel = z.object({
  logoUrl: z.string().nullable(),
});

export const ZOrganizationBilling = z.object({
  stripeCustomerId: z.string().nullable(),
  plan: z.enum(["free", "startup", "scale", "enterprise"]).prefault("free"),
  period: z.enum(["monthly", "yearly"]).prefault("monthly"),
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
  periodStart: z.coerce.date().nullable(),
});

export const ZOrganization = z.object({
  id: z.cuid2(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string(),
  whitelabel: ZOrganizationWhiteLabel,
  billing: ZOrganizationBilling as z.ZodType<Organization["billing"]>,
  isAIEnabled: z.boolean().prefault(false) as z.ZodType<Organization["isAIEnabled"]>,
}) satisfies z.ZodType<Organization>;
