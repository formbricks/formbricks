import { Organization, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

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
  async (organizationId: string): Promise<Pick<Organization, "isAIEnabled" | "billing"> | null> => {
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
  }
);
