import "server-only";
import { prisma } from "@formbricks/database";

/**
 * The names of the given surveys, scoped to the workspace. Bounded by the ids passed in — the surveys
 * a workspace's connectors read from.
 */
export const getWorkspaceSurveyNames = async (
  workspaceId: string,
  surveyIds: readonly string[]
): Promise<Map<string, string>> => {
  if (surveyIds.length === 0) return new Map();
  const surveys = await prisma.survey.findMany({
    where: { workspaceId, id: { in: [...surveyIds] } },
    select: { id: true, name: true },
  });
  return new Map(surveys.map((survey) => [survey.id, survey.name]));
};
