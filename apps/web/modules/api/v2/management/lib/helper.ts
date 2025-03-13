import {
  fetchEnvironmentId,
  fetchEnvironmentIdFromSurveyIds,
} from "@/modules/api/v2/management/lib/services";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Result, ok } from "@formbricks/types/error-handlers";

export const getEnvironmentId = async (
  id: string,
  isResponseId: boolean
): Promise<Result<string, ApiErrorResponseV2>> => {
  const result = await fetchEnvironmentId(id, isResponseId);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.environmentId);
};

/**
 * Validates that all surveys are in the same environment and return the environment id
 * @param surveyIds array of survey ids from the same environment
 * @returns the common environment id
 */
export const getEnvironmentIdFromSurveyIds = async (
  surveyIds: string[]
): Promise<Result<string, ApiErrorResponseV2>> => {
  const result = await fetchEnvironmentIdFromSurveyIds(surveyIds);

  if (!result.ok) {
    return result;
  }

  // Check if all items in the array are the same
  if (new Set(result.data).size !== 1) {
    return {
      ok: false,
      error: {
        type: "bad_request",
        details: [{ field: "surveyIds", issue: "not all surveys are in the same environment" }],
      },
    };
  }

  return ok(result.data[0]);
};
