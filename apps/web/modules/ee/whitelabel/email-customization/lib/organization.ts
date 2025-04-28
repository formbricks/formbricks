import "server-only";
import { cache } from "@/lib/cache";
import { organizationCache } from "@/lib/organization/cache";
import { projectCache } from "@/lib/project/cache";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const updateOrganizationEmailLogoUrl = async (
  organizationId: string,
  logoUrl: string
): Promise<boolean> => {
  validateInputs([organizationId, ZId], [logoUrl, ZString]);

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        whitelabel: {
          ...organization.whitelabel,
          logoUrl,
        },
      },
      select: {
        projects: {
          select: {
            id: true,
            environments: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    organizationCache.revalidate({
      id: organizationId,
    });

    for (const project of updatedOrganization.projects) {
      for (const environment of project.environments) {
        organizationCache.revalidate({
          environmentId: environment.id,
        });
      }
    }

    projectCache.revalidate({
      organizationId: organizationId,
    });

    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    throw error;
  }
};

export const removeOrganizationEmailLogoUrl = async (organizationId: string): Promise<boolean> => {
  validateInputs([organizationId, ZId]);

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whitelabel: true,
        projects: {
          select: {
            id: true,
            environments: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        whitelabel: {
          ...organization.whitelabel,
          logoUrl: null,
        },
      },
    });

    organizationCache.revalidate({
      id: organizationId,
    });

    for (const project of organization.projects) {
      for (const environment of project.environments) {
        organizationCache.revalidate({
          environmentId: environment.id,
        });
      }
    }

    projectCache.revalidate({
      organizationId: organizationId,
    });

    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    throw error;
  }
};

export const getOrganizationLogoUrl = reactCache(
  async (organizationId: string): Promise<string | null> =>
    cache(
      async () => {
        validateInputs([organizationId, ZId]);
        try {
          const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
              whitelabel: true,
            },
          });
          return organization?.whitelabel?.logoUrl ?? null;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getOrganizationLogoUrl-${organizationId}`],
      {
        tags: [organizationCache.tag.byId(organizationId)],
      }
    )()
);
