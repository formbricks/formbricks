import "server-only";
import { updateResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { evaluateQuotas, handleQuotas } from "@/modules/ee/quotas/lib/utils";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TResponse, TResponseInput } from "@formbricks/types/responses";

export const updateResponseWithQuotaEvaluation = async (
  responseId: string,
  responseInput: Partial<TResponseInput>
): Promise<TResponse> => {
  const response = await updateResponse(responseId, responseInput);

  const survey = await getSurvey(response.surveyId);
  if (!survey) {
    return response;
  }

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

    if (quotaFull && quotaFull.action === "endSurvey") {
      const refreshedResponse = await prisma.response.findUnique({ where: { id: response.id } });

      if (!refreshedResponse) {
        return response;
      }

      const updatedResponse = {
        ...refreshedResponse,
        tags: response.tags,
        contact: response.contact,
      };

      return updatedResponse;
    }

    return response;
  } catch (error) {
    logger.error({ error, responseId: response.id }, "Error evaluating quotas for response update");
    return response;
  }
};
