import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganizationBilling } from "@formbricks/types/organizations";

export const getOrganizationIdFromEnvironmentId = reactCache(
  async (environmentId: string): Promise<string> => {
    const organization = await prisma.organization.findFirst({
      where: {
        projects: {
          some: {
            environments: {
              some: { id: environmentId },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    return organization.id;
  }
);

export const getOrganizationAIKeys = reactCache(
  async (
    organizationId: string
  ): Promise<{
    isAISmartToolsEnabled: boolean;
    isAIDataAnalysisEnabled: boolean;
    billing: TOrganizationBilling;
  } | null> => {
    try {
      const organization = await prisma.organization.findUnique({
        where: {
          id: organizationId,
        },
        select: {
          isAISmartToolsEnabled: true,
          isAIDataAnalysisEnabled: true,
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
        isAISmartToolsEnabled: organization.isAISmartToolsEnabled,
        isAIDataAnalysisEnabled: organization.isAIDataAnalysisEnabled,
        billing: {
          stripeCustomerId: organization.billing.stripeCustomerId,
          limits: organization.billing.limits as TOrganizationBilling["limits"],
          usageCycleAnchor: organization.billing.usageCycleAnchor,
          ...(organization.billing.stripe === null ? {} : { stripe: organization.billing.stripe }),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
