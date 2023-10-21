import "server-only";

import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getTeamDetails = async (
  environmentId: string
): Promise<{ teamId: string; teamOwnerId: string | undefined }> => {
  validateInputs([environmentId, ZId]);
  try {
    const environment = await prisma.environment.findUnique({
      where: {
        id: environmentId,
      },
      select: {
        product: {
          select: {
            team: {
              select: {
                id: true,
                memberships: {
                  select: {
                    userId: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!environment) {
      throw new ResourceNotFoundError("Environment", environmentId);
    }

    const teamId: string = environment.product.team.id;
    // find team owner
    const teamOwnerId: string | undefined = environment.product.team.memberships.find(
      (m) => m.role === "owner"
    )?.userId;

    return {
      teamId: teamId,
      teamOwnerId: teamOwnerId,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
