import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TMembership, ZMembership } from "@formbricks/types/memberships";
import { validateInputs } from "@/lib/utils/validate";

export const getWorkspacesByUserId = reactCache(
  async (userId: string, orgMembership: TMembership): Promise<{ id: string; name: string }[]> => {
    validateInputs([userId, ZString], [orgMembership, ZMembership]);

    let workspaceWhereClause: Prisma.WorkspaceWhereInput = {};

    if (orgMembership.role === "member") {
      workspaceWhereClause = {
        workspaceTeams: {
          some: {
            team: {
              teamUsers: {
                some: {
                  userId,
                },
              },
            },
          },
        },
      };
    }

    try {
      const workspaces = await prisma.workspace.findMany({
        where: {
          organizationId: orgMembership.organizationId,
          ...workspaceWhereClause,
        },
        select: {
          id: true,
          name: true,
        },
      });
      return workspaces;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
