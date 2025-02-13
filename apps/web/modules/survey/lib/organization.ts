import { Organization, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getOrganizationIdFromEnvironmentId = reactCache(
  async (environmentId: string): Promise<string> =>
    cache(
      async () => {
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
      },
      [`survey-lib-getOrganizationIdFromEnvironmentId-${environmentId}`],
      {
        tags: [organizationCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getOrganizationAIKeys = reactCache(
  async (organizationId: string): Promise<Pick<Organization, "isAIEnabled" | "billing"> | null> =>
    cache(
      async () => {
        try {
          const organization = await prisma.organization.findUnique({
            where: {
              id: organizationId,
            },
            select: {
              isAIEnabled: true,
              billing: true,
            },
          });
          return organization;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`survey-lib-getOrganizationAIKeys-${organizationId}`],
      {
        tags: [organizationCache.tag.byId(organizationId)],
      }
    )()
);
