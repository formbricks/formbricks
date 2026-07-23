import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId, ZStorageUrl } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganizationWhitelabel } from "@formbricks/types/organizations";
import { validateInputs } from "@/lib/utils/validate";

export const updateOrganizationFaviconUrl = async (
  organizationId: string,
  faviconUrl: string | null
): Promise<boolean> => {
  validateInputs([organizationId, ZId], [faviconUrl, ZStorageUrl.nullable()]);

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { whitelabel: true },
    });

    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const existingWhitelabel = (organization.whitelabel ?? {}) as TOrganizationWhitelabel;

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        whitelabel: {
          ...existingWhitelabel,
          faviconUrl,
        },
      },
    });

    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RecordNotFound
    ) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    throw error;
  }
};
