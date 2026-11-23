import "server-only";
import { prisma } from "@formbricks/database";
import type { WorkflowTestRunResponse } from "@formbricks/workflows/server";

/** Whether the caller may not read this survey (ENG-3282); bound to the request by the adapter. */
export type TIsSurveyHidden = (input: { workspaceId: string; surveyId: string }) => Promise<boolean>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The response a Response completed Test run runs against (ADR 0049), or null. The id comes from the
 * request, so this is the tenant check: the response must belong to the trigger's survey, that survey
 * to the workflow's workspace, and the caller must be able to read the survey, since the run shows
 * its answers. A response that fails any of them is answered like one that does not exist.
 */
export const loadTestRunResponse = async (
  { workspaceId, surveyId, responseId }: { workspaceId: string; surveyId: string; responseId: string },
  isSurveyHidden: TIsSurveyHidden
): Promise<WorkflowTestRunResponse | null> => {
  if (await isSurveyHidden({ workspaceId, surveyId })) return null;

  const response = await prisma.response.findFirst({
    where: { id: responseId, surveyId, survey: { id: surveyId, workspaceId } },
    select: { id: true, surveyId: true, endingId: true, data: true },
  });
  if (!response) return null;

  return {
    id: response.id,
    surveyId: response.surveyId,
    endingId: response.endingId,
    data: isRecord(response.data) ? response.data : {},
  };
};
