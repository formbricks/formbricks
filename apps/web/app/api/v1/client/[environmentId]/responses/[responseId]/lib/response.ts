import { updateResponse } from "@/lib/response/service";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { TResponseUpdateInput } from "@formbricks/types/responses";

export const updateResponseWithQuotaEvaluation = async (
  responseId: string,
  responseInput: TResponseUpdateInput
): Promise<TResponseWithQuotaFull> => {
  const response = await updateResponse(responseId, responseInput);

  const quotaResult = await evaluateResponseQuotas({
    surveyId: response.surveyId,
    responseId: response.id,
    data: response.data,
    variables: response.variables,
    language: response.language || "default",
    responseFinished: response.finished,
  });

  return {
    ...response,
    ...(quotaResult.quotaFull && { quotaFull: quotaResult.quotaFull }),
  };
};
