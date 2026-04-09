import { Result, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { fetchWorkspaceId, fetchWorkspaceIdFromSurveyIds } from "./services";

export const getWorkspaceId = async (
  id: string,
  isResponseId: boolean
): Promise<Result<{ workspaceId: string }, ApiErrorResponseV2>> => {
  const result = await fetchWorkspaceId(id, isResponseId);

  if (!result.ok) {
    return { ok: false, error: result.error as ApiErrorResponseV2 };
  }

  return ok({ workspaceId: result.data.workspaceId });
};

/**
 * Validates that all surveys are in the same workspace and return the workspace id
 * @param surveyIds array of survey ids from the same workspace
 * @returns the common workspace id
 */
export const getWorkspaceIdFromSurveyIds = async (
  surveyIds: string[]
): Promise<Result<string | null, ApiErrorResponseV2>> => {
  if (surveyIds.length === 0) return ok(null);

  const result = await fetchWorkspaceIdFromSurveyIds(surveyIds);

  if (!result.ok) {
    return { ok: false, error: result.error as ApiErrorResponseV2 };
  }

  // Check if all items in the array are the same
  if (new Set(result.data).size !== 1) {
    return {
      ok: false,
      error: {
        type: "bad_request",
        details: [{ field: "surveyIds", issue: "not all surveys are in the same workspace" }],
      },
    };
  }

  return ok(result.data[0]);
};
