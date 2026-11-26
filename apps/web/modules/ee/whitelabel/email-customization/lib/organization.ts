import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId, ZStorageUrl } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { type TOrganizationEmailLogo, getEmailLogo } from "./email-logo";

export const updateOrganizationEmailLogoUrl = async (
  organizationId: string,
  logoUrl: string
): Promise<boolean> => {
  validateInputs([organizationId, ZId], [logoUrl, ZStorageUrl]);

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    // A new logo undoes an earlier removal, so `hideLogo` goes with the old value.
    const { hideLogo: _removed, ...whitelabel } = organization.whitelabel ?? {};
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        whitelabel: {
          ...whitelabel,
          logoUrl,
        },
      },
      select: {
        workspaces: {
          select: {
            id: true,
          },
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

export const removeOrganizationEmailLogoUrl = async (organizationId: string): Promise<boolean> => {
  validateInputs([organizationId, ZId]);

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whitelabel: true,
        workspaces: {
          select: {
            id: true,
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
        // `logoUrl: null` alone means "use the Formbricks logo"; `hideLogo` records that the
        // organization wants no logo at all.
        whitelabel: {
          ...organization.whitelabel,
          logoUrl: null,
          hideLogo: true,
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

export const getOrganizationEmailLogo = reactCache(
  async (organizationId: string): Promise<TOrganizationEmailLogo> => {
    validateInputs([organizationId, ZId]);
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          whitelabel: true,
        },
      });
      return getEmailLogo(organization?.whitelabel);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
