import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

/** Seats in use: one cheap count, not the full usage report. */
export const getOrganizationMemberCount = reactCache(async (organizationId: string): Promise<number> => {
  validateInputs([organizationId, ZId]);

  try {
    return await prisma.membership.count({ where: { organizationId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Any one workspace of the organization (the oldest, so the answer is stable). The licence recheck
 * action authorizes through a workspace, so the button needs an id even when usage rows are empty.
 */
export const getFirstWorkspaceId = reactCache(async (organizationId: string): Promise<string | null> => {
  validateInputs([organizationId, ZId]);

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { organizationId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return workspace?.id ?? null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});
