import { prisma } from "@formbricks/database";
import { Result, ok } from "@formbricks/types/error-handlers";
import { fetchWorkspaceId, fetchWorkspaceIdFromSurveyIds } from "@/modules/api/v2/management/lib/services";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const getWorkspaceId = async (
  id: string,
  isResponseId: boolean
): Promise<Result<{ workspaceId: string; environmentId: string }, ApiErrorResponseV2>> => {
  const result = await fetchWorkspaceId(id, isResponseId);

  if (!result.ok) {
    return { ok: false, error: result.error as ApiErrorResponseV2 };
  }

  return ok(result.data);
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

/**
 * Resolves a workspaceId to its production environment's ID.
 * Used when management API callers provide workspaceId instead of environmentId.
 */
export const getProductionEnvironmentIdByWorkspaceId = async (
  workspaceId: string
): Promise<Result<string, ApiErrorResponseV2>> => {
  const environment = await prisma.environment.findFirst({
    where: {
      workspaceId,
      type: "production",
    },
    select: { id: true },
  });

  if (!environment) {
    return {
      ok: false,
      error: {
        type: "not_found",
        details: [{ field: "workspaceId", issue: "workspace not found or has no production environment" }],
      },
    };
  }

  return ok(environment.id);
};
