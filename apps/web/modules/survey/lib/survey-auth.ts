import "server-only";
import { notFound } from "next/navigation";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { hasUserWorkspaceAccessForAction } from "@/lib/workspace/auth";
import { getSession } from "@/modules/auth/lib/session";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TWorkspaceAuth } from "@/modules/workspaces/types/workspace-auth";

/**
 * Resolves the workspace a survey belongs to, or null when the survey does not exist.
 */
const getWorkspaceIdOfSurvey = reactCache(async (surveyId: string): Promise<string | null> => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { workspaceId: true },
    });

    return survey?.workspaceId ?? null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error resolving the workspace of a survey");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * True when the survey exists and lives in the given workspace.
 */
const doesSurveyBelongToWorkspace = async (workspaceId: string, surveyId: string): Promise<boolean> => {
  const surveyWorkspaceId = await getWorkspaceIdOfSurvey(surveyId);
  return surveyWorkspaceId !== null && surveyWorkspaceId === workspaceId;
};

/**
 * True when the caller may read this survey through this workspace's routes.
 *
 * Non-throwing variant of {@link getSurveyAuth}, for callers that must degrade gracefully
 * instead of interrupting the render — `generateMetadata`, which resolves independently of
 * the page and would otherwise put a survey name the caller may not read into the title.
 *
 * Takes `(workspaceId, surveyId)` in the same order as {@link getSurveyAuth}: both guards are
 * `(string, string)`, so a swapped call would typecheck silently.
 */
export const canReadSurveyInWorkspace = async (workspaceId: string, surveyId: string): Promise<boolean> => {
  // Ordered so the cheap, unvalidated tie check rejects made-up ids before they reach the
  // access check, which validates its inputs.
  if (!(await doesSurveyBelongToWorkspace(workspaceId, surveyId))) {
    return false;
  }

  const session = await getSession();
  if (!session) {
    return false;
  }

  return hasUserWorkspaceAccessForAction(session.user.id, workspaceId, "GET");
};

/**
 * Authorization for pages addressed by both a workspace id and a survey id.
 *
 * `getWorkspaceAuth` only ever sees the workspace in the URL, so on its own it cannot
 * tell whether the survey in the URL is one of that workspace's surveys. Composing
 * "authorize workspace A" with "load survey X" therefore lets any authenticated user
 * substitute their own workspace id and read a foreign survey — its definition, its
 * response counts and its response content. This helper ties the two together and is
 * the choke point every survey-scoped page must go through.
 *
 * Fails closed with a 404 rather than a 403, so a foreign survey id is indistinguishable
 * from one that does not exist.
 */
export const getSurveyAuth = reactCache(
  async (workspaceId: string, surveyId: string): Promise<TWorkspaceAuth> => {
    const [workspaceAuth, surveyWorkspaceId] = await Promise.all([
      getWorkspaceAuth(workspaceId),
      getWorkspaceIdOfSurvey(surveyId),
    ]);

    if (surveyWorkspaceId !== workspaceAuth.workspace.id) {
      notFound();
    }

    return workspaceAuth;
  }
);
