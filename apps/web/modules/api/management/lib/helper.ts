import { getSurveyAndEnvironmentId } from "@/modules/api/management/lib/services";
import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { Result, ok } from "@formbricks/types/error-handlers";

export const getEnvironmentId = async (
  id: string,
  isResponseId: boolean
): Promise<Result<string, ApiErrorResponse>> => {
  const result = await getSurveyAndEnvironmentId(id, isResponseId);

  if (!result.ok) {
    return result;
  }

  return ok(result.data.environmentId);
};
