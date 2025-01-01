import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZString } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";

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

    updatedOrganization.projects.forEach((project) => {
      project.environments.forEach((environment) => {
        organizationCache.revalidate({
          environmentId: environment.id,
        });
      });
    });

    projectCache.revalidate({
      organizationId: organizationId,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
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

    projectCache.revalidate({
      organizationId: organizationId,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    throw error;
  }
};
