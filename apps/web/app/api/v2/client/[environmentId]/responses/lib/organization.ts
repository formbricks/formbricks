import { cache } from "@/lib/cache";
import { organizationCache } from "@/lib/organization/cache";
import { Organization } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";

export const getOrganizationBillingByEnvironmentId = reactCache(
  async (environmentId: string): Promise<Organization["billing"] | null> =>
    cache(
      async () => {
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
              billing: true,
            },
          });

          if (!organization) {
            return null;
          }

          return organization.billing;
        } catch (error) {
          logger.error(error, "Failed to get organization billing by environment ID");
          return null;
        }
      },
      [`api-v2-client-getOrganizationBillingByEnvironmentId-${environmentId}`],
      {
        tags: [organizationCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
