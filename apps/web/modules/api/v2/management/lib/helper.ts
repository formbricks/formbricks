import { fetchEnvironmentId } from "@/modules/api/v2/management/lib/services";
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
