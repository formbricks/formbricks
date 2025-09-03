import "server-only";
import { updateResponse } from "@/lib/response/service";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { TResponse, TResponseInput } from "@formbricks/types/responses";

export const updateResponseWithQuotaEvaluation = async (
  responseId: string,
  responseInput: Partial<TResponseInput>
): Promise<TResponse> => {
  const response = await updateResponse(responseId, responseInput);

  const quotaResult = await evaluateResponseQuotas({
    surveyId: response.surveyId,
    responseId: response.id,
    data: response.data,
    variables: response.variables,
    language: response.language || "default",
  });

  if (quotaResult.shouldEndSurvey && quotaResult.refreshedResponse) {
    return {
      ...quotaResult.refreshedResponse,
      tags: response.tags,
      contact: response.contact,
    };
  }

  return response;
};
