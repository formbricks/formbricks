import { TResponseWithQuotaFull } from "@/app/api/v1/client/[environmentId]/responses/lib/response";
import { updateResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { evaluateQuotas, handleQuotas } from "@/modules/ee/quotas/lib/utils";
import { logger } from "@formbricks/logger";
import { TResponseUpdateInput } from "@formbricks/types/responses";

export const updateResponseWithQuotaEvaluation = async (
  responseId: string,
  responseInput: TResponseUpdateInput
): Promise<TResponseWithQuotaFull> => {
  const response = await updateResponse(responseId, responseInput);

  try {
    const quotas = await getQuotas(response.surveyId);

    if (!quotas || quotas.length === 0) {
      return response;
    }

    const survey = await getSurvey(response.surveyId);
    if (!survey) {
      return response;
    }

    const result = evaluateQuotas(
      survey,
      response.data,
      response.variables || {},
      quotas,
      response.language || "default"
    );

    const quotaFull = await handleQuotas(response.surveyId, response.id, result);

    return {
      ...response,
      ...(quotaFull && { quotaFull }),
    };
  } catch (error) {
    logger.error({ error, responseId: response.id }, "Error evaluating quotas for response update");
    return response;
  }
};
