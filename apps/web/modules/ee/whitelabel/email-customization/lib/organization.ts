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
): Promise<Boolean> => {
  validateInputs([organizationId, ZId], [logoUrl, ZString]);

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
          logoUrl,
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

export const removeOrganizationEmailLogoUrl = async (organizationId: string): Promise<Boolean> => {
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
