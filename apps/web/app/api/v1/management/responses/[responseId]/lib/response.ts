import "server-only";
import { prisma } from "@formbricks/database";
import { TResponse, TResponseInput } from "@formbricks/types/responses";
import { updateResponse } from "@/lib/response/service";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";

export const updateResponseWithQuotaEvaluation = async (
  responseId: string,
  responseInput: Partial<TResponseInput>
): Promise<TResponse> => {
  const txResponse = await prisma.$transaction(async (tx) => {
    const response = await updateResponse(responseId, responseInput, tx);

    const quotaResult = await evaluateResponseQuotas({
      surveyId: response.surveyId,
      responseId: response.id,
      data: response.data,
      variables: response.variables,
      language: response.language || "default",
      responseFinished: response.finished,
      tx,
    });

    if (quotaResult.shouldEndSurvey && quotaResult.refreshedResponse) {
      return {
        ...quotaResult.refreshedResponse,
        tags: response.tags,
        contact: response.contact,
      };
    }

    return response;
  });

  return txResponse;
};
