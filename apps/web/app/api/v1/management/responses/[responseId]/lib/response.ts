import "server-only";
import { prisma } from "@formbricks/database";
import { TResponse, TResponseInput } from "@formbricks/types/responses";
import { updateResponse } from "@/lib/response/service";
import {
  evaluateResponseQuotas,
  loadQuotaEvaluationContext,
} from "@/modules/ee/quotas/lib/evaluation-service";

/**
 * `surveyId` is the stored response's survey, as the route already loaded it — passed in so the quota
 * definitions are read before the transaction opens. Evaluation still checks it against the updated
 * row and skips on a mismatch.
 */
export const updateResponseWithQuotaEvaluation = async (
  responseId: string,
  surveyId: string,
  responseInput: Partial<TResponseInput>
): Promise<TResponse> => {
  const quotaContext = await loadQuotaEvaluationContext(surveyId);

  const txResponse = await prisma.$transaction(async (tx) => {
    const response = await updateResponse(responseId, responseInput, tx);

    const quotaResult = await evaluateResponseQuotas({
      surveyId: response.surveyId,
      responseId: response.id,
      data: response.data,
      variables: response.variables,
      language: response.language || "default",
      responseFinished: response.finished,
      // The row just written, so `reserved` quota operands resolve (ENG-1840).
      response,
      tx,
      quotaContext,
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
