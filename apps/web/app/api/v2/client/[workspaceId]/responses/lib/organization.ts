import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TOrganizationBilling } from "@formbricks/types/organizations";

export const getOrganizationBillingByWorkspaceId = reactCache(
  async (workspaceId: string): Promise<TOrganizationBilling | null> => {
    try {
      const organization = await prisma.organization.findFirst({
        where: {
          workspaces: {
            some: {
              id: workspaceId,
            },
          },
        },
        select: {
          billing: {
            select: {
              stripeCustomerId: true,
              limits: true,
              usageCycleAnchor: true,
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
        usageCycleAnchor: organization.billing.usageCycleAnchor,
        ...(organization.billing.stripe === null
          ? {}
          : { stripe: organization.billing.stripe as TOrganizationBilling["stripe"] }),
      };
    } catch (error) {
      logger.error(error, "Failed to get organization billing by workspace ID");
      return null;
    }
  }
);
