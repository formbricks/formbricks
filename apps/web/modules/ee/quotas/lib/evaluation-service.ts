import "server-only";
import { getSurvey } from "@/lib/survey/service";
import { Prisma, Response } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TSurveyQuota } from "@formbricks/types/quota";
import { getQuotas } from "./quotas";
import { evaluateQuotas, handleQuotas } from "./utils";

export interface QuotaEvaluationInput {
  surveyId: string;
  responseId: string;
  data: Response["data"];
  responseFinished: boolean;
  variables?: Response["variables"];
  language?: string;
  tx?: Prisma.TransactionClient;
}

export interface QuotaEvaluationResult {
  quotaFull?: TSurveyQuota | null;
  shouldEndSurvey: boolean;
  refreshedResponse?: Response | null;
}

/**
 * Reusable common quota evaluation logic for all API versions
 * @param input - The quota evaluation input containing survey, response, and form data
 * @returns The quota evaluation result with quotaFull, shouldEndSurvey, and refreshedResponse
 */
export const evaluateResponseQuotas = async (input: QuotaEvaluationInput): Promise<QuotaEvaluationResult> => {
  const {
    surveyId,
    responseId,
    data,
    variables = {},
    language = "default",
    responseFinished = false,
    tx,
  } = input;
  const prismaClient = tx ?? prisma;

  try {
    const quotas = await getQuotas(surveyId);

    if (!quotas || quotas.length === 0) {
      return { shouldEndSurvey: false };
    }

    const survey = await getSurvey(surveyId);
    if (!survey) {
      return { shouldEndSurvey: false };
    }

    const result = evaluateQuotas(survey, data, variables, quotas, language);

    const quotaFull = await handleQuotas(surveyId, responseId, result, responseFinished, prismaClient);

    if (quotaFull && quotaFull.action === "endSurvey") {
      const refreshedResponse = await prismaClient.response.findUnique({
        where: { id: responseId },
      });

      return {
        quotaFull,
        shouldEndSurvey: true,
        refreshedResponse,
      };
    }

    return {
      quotaFull,
      shouldEndSurvey: false,
    };
  } catch (error) {
    logger.error({ error, responseId }, "Error evaluating quotas for response");
    return { shouldEndSurvey: false };
  }
};
