import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getOrganizationsByUserId = reactCache(
  async (userId: string): Promise<{ id: string; name: string }[]> => {
    validateInputs([userId, ZString]);

    try {
      const organizations = await prisma.organization.findMany({
        where: {
          memberships: {
            some: {
              userId,
            },
          },
        },
        // Deterministic order so callers that take organizations[0] (e.g. account settings'
        // default org) always resolve the same organization for a given user.
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          name: true,
        },
      });
      if (!organizations) {
        throw new ResourceNotFoundError("Organizations by UserId", userId);
      }
      return organizations;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
