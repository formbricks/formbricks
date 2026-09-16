import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma, Response } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { TEmbeddedValueResponse } from "@formbricks/types/embedded-data-resolver";
import { TSurveyQuota } from "@formbricks/types/quota";
import { toJsWorkspaceStateSurvey } from "@/lib/survey/client-utils";
import { getSurvey } from "@/lib/survey/service";
import { buildServerEmbeddedValues } from "@/lib/surveyLogic/utils";
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
  /**
   * The persisted response, used only to resolve `reserved` quota operands (ENG-1840) — a quota
   * condition on `country`, `browser` or `finished` reads its value from here via the reserved field
   * catalog. Optional so a caller without the row in hand still evaluates: those operands then read
   * as unset, exactly like an absent hidden field. Passed rather than re-fetched on purpose; every
   * call site already holds the row it just wrote, and quota evaluation runs inside the ingest
   * transaction where an extra query would be paid on every response.
   */
  response?: TEmbeddedValueResponse;
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
    response,
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
    const isDefaultLanguage = survey.languages.find((lang) => lang.default)?.language.code === language;
    const jsSurvey = toJsWorkspaceStateSurvey(survey);
    const result = evaluateQuotas(
      jsSurvey,
      data,
      variables,
      quotas,
      isDefaultLanguage ? "default" : language,
      // The survey is what lets a declared field of the same name shadow the reserved read
      // (ENG-2538); without it a quota on `url` counted the page address for every response whose
      // declared `url` was left blank.
      response ? buildServerEmbeddedValues(response, jsSurvey) : {}
    );

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
