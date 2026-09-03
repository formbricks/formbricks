import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { validateInputs } from "@/lib/utils/validate";

const findWorkspacesForOrganization = async (
  userId: string,
  organizationId: string,
  { writableOnly }: { writableOnly: boolean }
): Promise<{ id: string; name: string }[]> => {
  validateInputs([userId, ZId], [organizationId, ZId]);

  try {
    const workspaceIds = await lookupAuthorizedWorkspaceIds(
      { type: "user", id: userId },
      writableOnly ? "write" : "read"
    );
    if (workspaceIds.length === 0) return [];

    const workspaces = await prisma.workspace.findMany({
      where: {
        id: { in: [...workspaceIds] },
        organizationId,
      },
      select: {
        id: true,
        name: true,
      },
      // Deterministic order so the org-settings fallback workspace (workspaces[0]) is stable
      // rather than arbitrary DB order when no active-workspace cookie is present.
      orderBy: { createdAt: "asc" },
    });
    return workspaces;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getWorkspacesByUserId = reactCache(
  async (userId: string, organizationId: string): Promise<{ id: string; name: string }[]> =>
    findWorkspacesForOrganization(userId, organizationId, { writableOnly: false })
);

export const getWritableWorkspacesByUserId = reactCache(
  async (userId: string, organizationId: string): Promise<{ id: string; name: string }[]> =>
    findWorkspacesForOrganization(userId, organizationId, { writableOnly: true })
);
