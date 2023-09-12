import { prisma } from "@formbricks/database";
import { TMembership } from "@formbricks/types/v1/membership";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { Prisma } from "@prisma/client";

export async function getMemberships(userId: string): Promise<TMembership[]> {
  // get memberships
  try {
    const memberships = await prisma.membership.findMany({
      where: {
        userId,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            products: {
              select: {
                id: true,
                name: true,
                environments: {
                  select: {
                    id: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return memberships;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
}
