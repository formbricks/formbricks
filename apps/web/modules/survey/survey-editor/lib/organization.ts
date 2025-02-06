import { Organization, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getOrganizationBilling = reactCache(
  async (environmentId: string): Promise<Pick<Organization, "billing" | "id"> | null> =>
    cache(
      async () => {
        try {
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
              billing: true,
            },
          });

          if (!organization) {
            throw new ResourceNotFoundError("Organization", null);
          }

          return organization;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`survey-editor-getOrganizationBilling-${environmentId}`],
      {
        tags: [organizationCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
