import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

type Plan = "free" | "startup" | "scale";

interface TOrganization {
  id: string;
  billing: {
    plan: Plan;
    limits: {
      monthly: {
        responses: number;
        miu: number;
      };
    };
  };
}

export const BILLING_LIMITS = {
  free: {
    RESPONSES: 1500,
    MIU: 2000,
  },
  startup: {
    RESPONSES: 5000,
    MIU: 7500,
  },
  scale: {
    RESPONSES: 10000,
    MIU: 30000,
  },
} as const;

export const updateOrgLimits: MigrationScript = {
  type: "data",
  id: "ax4otbz2f295rit6kn1jeu8l",
  name: "20241209111525_update_org_limits",
  run: async ({ tx }) => {
    // Your migration script goes here
    // Find organizations that need updates
    const organizations = await tx.$queryRaw<TOrganization[]>`
      SELECT id, billing
      FROM "Organization"
      WHERE
        (
          (billing->>'plan' = 'free' AND
          (
            (billing->'limits'->'monthly'->>'miu')::numeric != 2000 OR
            (billing->'limits'->'monthly'->>'responses')::numeric != 1500
          )
          )
          OR
          (
            (billing->>'plan' = 'startup' AND
            (
              (billing->'limits'->'monthly'->>'miu')::numeric != 7500 OR
              (billing->'limits'->'monthly'->>'responses')::numeric != 5000
            )
            )
          )
          OR
          (
            (billing->>'plan' = 'scale' AND
            (
              (billing->'limits'->'monthly'->>'miu')::numeric != 30000 OR
              (billing->'limits'->'monthly'->>'responses')::numeric != 10000
            )
            )
          )
        )
    `;

    const updationPromises = [];

    // Batch update organizations
    for (const organization of organizations) {
      const plan = organization.billing.plan;
      const limits = BILLING_LIMITS[plan];

      const updatedBilling = {
        ...organization.billing,
        limits: {
          ...organization.billing.limits,
          monthly: {
            ...organization.billing.limits.monthly,
            responses: limits.RESPONSES,
            miu: limits.MIU,
          },
        },
      };

      const updatePromise = tx.$executeRaw`UPDATE "Organization" SET billing = ${updatedBilling}::jsonb WHERE id = ${organization.id}`;
      updationPromises.push(updatePromise);
    }

    await Promise.all(updationPromises);

    logger.info(`Updated ${organizations.length.toString()} organizations`);
  },
};
