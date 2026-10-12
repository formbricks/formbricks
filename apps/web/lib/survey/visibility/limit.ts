import "server-only";
import { prisma } from "@formbricks/database";
import { env } from "@/lib/env";

export const DEFAULT_SURVEY_WORKSPACE_LIMIT = 10_000;

export class WorkspaceSurveyLimitError extends Error {
  readonly count: number;
  readonly limit: number;

  constructor(limit: number, count: number) {
    super("Workspace survey limit reached");
    this.name = "WorkspaceSurveyLimitError";
    this.count = count;
    this.limit = limit;
  }
}

export const getSurveyWorkspaceLimit = (): number =>
  env.SURVEY_WORKSPACE_LIMIT ?? DEFAULT_SURVEY_WORKSPACE_LIMIT;

/**
 * Refuse a new survey in a workspace already at the cap (RFC §2b). Archived surveys count: they keep
 * their relationships. A soft bound — two concurrent creates at the edge can both pass — which is fine
 * for a guard whose job is to keep a workspace's graph from growing without limit.
 */
export const assertWorkspaceSurveyLimit = async (workspaceId: string): Promise<void> => {
  const limit = getSurveyWorkspaceLimit();
  const count = await prisma.survey.count({ where: { workspaceId } });
  if (count >= limit) throw new WorkspaceSurveyLimitError(limit, count);
};
