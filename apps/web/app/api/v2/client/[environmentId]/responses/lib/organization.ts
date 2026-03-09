import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TOrganizationBilling } from "@formbricks/types/organizations";

export const getOrganizationBillingByEnvironmentId = reactCache(
  async (environmentId: string): Promise<TOrganizationBilling | null> => {
    try {
      const organization = await prisma.organization.findFirst({
        where: {
          projects: {
            some: {
              environments: {
                some: {
                  id: environmentId,
                },
              },
            },
          },
        },
        select: {
          billing: {
            select: {
              stripeCustomerId: true,
              limits: true,
              periodStart: true,
              stripe: true,
            },
          },
        },
      });

      if (!organization?.billing) {
        return null;
      }

      return {
        stripeCustomerId: organization.billing.stripeCustomerId,
        limits: organization.billing.limits as TOrganizationBilling["limits"],
        periodStart: organization.billing.periodStart,
        ...(organization.billing.stripe === null
          ? {}
          : { stripe: organization.billing.stripe as TOrganizationBilling["stripe"] }),
      };
    } catch (error) {
      logger.error(error, "Failed to get organization billing by environment ID");
      return null;
    }
  }
);
