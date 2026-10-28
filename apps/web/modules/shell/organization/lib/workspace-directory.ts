import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { validateInputs } from "@/lib/utils/validate";

export const WORKSPACE_DIRECTORY_LIMIT = 200;

export interface TWorkspaceListItem {
  id: string;
  name: string;
  createdAt: Date;
  surveyCount: number;
}

/**
 * The organization's workspaces with their survey counts in one query. Owners and managers see all of
 * them; everyone else only the workspaces the authorization graph lets them read.
 */
export const getWorkspaceDirectory = reactCache(
  async ({
    organizationId,
    viewerId,
    canSeeAll,
  }: {
    organizationId: string;
    viewerId: string;
    canSeeAll: boolean;
  }): Promise<TWorkspaceListItem[]> => {
    validateInputs([organizationId, ZId], [viewerId, ZId]);

    try {
      const authorizedIds = canSeeAll
        ? null
        : await lookupAuthorizedWorkspaceIds({ type: "user", id: viewerId });

      const workspaces = await prisma.workspace.findMany({
        where: { organizationId, ...(authorizedIds ? { id: { in: [...authorizedIds] } } : {}) },
        select: { id: true, name: true, createdAt: true, _count: { select: { surveys: true } } },
        orderBy: { createdAt: "asc" },
        take: WORKSPACE_DIRECTORY_LIMIT,
      });

      return workspaces.map(({ _count, ...workspace }) => ({ ...workspace, surveyCount: _count.surveys }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
