import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";

/**
 * The id of the survey's segment when it is not from the workspace's current contact directory, or the
 * workspace has none; null otherwise. A workspace that left a directory keeps its surveys' segment links
 * (ADR 0061), and filters of another directory's segment match nobody the workspace can identify, so the
 * targeting card asks for new targeting.
 */
export const getOtherDirectorySegmentId = reactCache(async (surveyId: string): Promise<string | null> => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: {
        segment: { select: { id: true, directoryId: true } },
        workspace: { select: { contactDirectoryId: true } },
      },
    });
    const segment = survey?.segment;
    if (!segment) return null;

    const workspaceDirectoryId = survey.workspace.contactDirectoryId;
    if (workspaceDirectoryId !== null && segment.directoryId === workspaceDirectoryId) return null;
    return segment.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});
