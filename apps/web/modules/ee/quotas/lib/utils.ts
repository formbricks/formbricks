import "server-only";
import { updateResponse } from "@/lib/response/service";
import { evaluateLogic } from "@/lib/surveyLogic/utils";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";

/**
 * Evaluates quotas against response data to determine screening status
 * @param survey - Survey with questions and variables for evaluation context
 * @param responseData - Response data to evaluate against quota conditions
 * @param variablesData - Variables data for evaluation
 * @param quotas - Active quota definitions for the survey
 * @param selectedLanguage - Language for evaluation context
 * @returns Object with passed and failed quotas
 */
export const evaluateQuotas = (
  survey: TJsEnvironmentStateSurvey,
  responseData: TResponseData,
  variablesData: TResponseVariables,
  quotas: TSurveyQuota[],
  selectedLanguage: string = "default"
): { passedQuotas: TSurveyQuota[]; failedQuotas: TSurveyQuota[] } => {
  const passedQuotas: TSurveyQuota[] = [];
  const failedQuotas: TSurveyQuota[] = [];

  for (const quota of quotas) {
    const conditions = {
      id: quota.id,
      ...quota.logic,
    };

    const conditionsMatch = evaluateLogic(survey, responseData, variablesData, conditions, selectedLanguage);

    if (conditionsMatch) {
      passedQuotas.push(quota);
    } else {
      failedQuotas.push(quota);
    }
  }

  return { passedQuotas, failedQuotas };
};

/**
 * Upserts ResponseQuotaLink records for a response
 * @param responseId - Response ID to link to quotas
 * @param fullQuota - IDs of quotas that are full
 * @param otherQuota - IDs of quotas that are not full
 * @param failedQuotas - IDs of quotas that are failed
 * @param tx - Transaction client
 */
export const upsertResponseQuotaLinks = async (
  responseId: string,
  fullQuota: TSurveyQuota[],
  otherQuota: TSurveyQuota[],
  failedQuotas: TSurveyQuota[],
  tx: Prisma.TransactionClient
): Promise<void> => {
  // remove records for quotas that failed
  await tx.responseQuotaLink.deleteMany({
    where: {
      responseId,
      quotaId: { in: failedQuotas.map((quota) => quota.id) },
    },
  });

  const fullQuotaIds = fullQuota.map((quota) => quota.id);
  const otherQuotaIds = otherQuota.map((quota) => quota.id);

  if (fullQuotaIds.length > 0) {
    // Create new records for full quotas
    await tx.responseQuotaLink.createMany({
      data: fullQuotaIds.map((quotaId) => ({
        responseId,
        quotaId,
        status: "screenedOut",
      })),
      skipDuplicates: true,
    });

    // Update existing records for full quotas to screenedOut
    await tx.responseQuotaLink.updateMany({
      where: {
        responseId,
        quotaId: { in: fullQuotaIds },
        status: { not: "screenedOut" },
      },
      data: {
        status: "screenedOut",
      },
    });
  }

  if (otherQuotaIds.length > 0) {
    // Create new records for other quotas
    await tx.responseQuotaLink.createMany({
      data: otherQuotaIds.map((quotaId) => ({
        responseId,
        quotaId,
        status: "screenedIn",
      })),
      skipDuplicates: true,
    });
  }
};

/**
 * Checks if any quota is full and returns the appropriate quota-full response
 * @param surveyId - Survey ID to check quotas for
 * @param responseId - Response ID to check quotas for
 * @param result - Current evaluation results
 * @param responseFinished - Whether the response is finished
 * @param tx - Transaction client
 * @returns Quota-full response if any quota is full, null otherwise
 */
export const handleQuotas = async (
  surveyId: string,
  responseId: string,
  result: { passedQuotas: TSurveyQuota[]; failedQuotas: TSurveyQuota[] },
  responseFinished: boolean,
  tx: Prisma.TransactionClient
): Promise<TSurveyQuota | null> => {
  try {
    validateInputs([surveyId, ZId], [responseId, ZId]);

    let firstScreenedOutQuota: TSurveyQuota | null = null;
    let fullQuota: TSurveyQuota[] = [];
    let otherQuota: TSurveyQuota[] = [];

    const quotaCounts =
      result.passedQuotas.length > 0
        ? await tx.responseQuotaLink.groupBy({
            by: ["quotaId"],
            where: {
              quotaId: { in: result.passedQuotas.map((q) => q.id) },
              status: "screenedIn",
              response: {
                id: { not: responseId },
              },
              OR: [{ quota: { countPartialSubmissions: true } }, { response: { finished: true } }],
            },
            _count: {
              responseId: true,
            },
          })
        : [];

    const quotaCountsMap = new Map(quotaCounts.map((result) => [result.quotaId, result._count.responseId]));

    for (const quota of result.passedQuotas) {
      const screenedInCount = quotaCountsMap.get(quota.id) ?? 0;

      if (screenedInCount >= quota.limit) {
        firstScreenedOutQuota ??= quota;
        fullQuota.push(quota);
      } else {
        otherQuota.push(quota);
      }
    }

    // To check if response is ending at this point
    if (!responseFinished && firstScreenedOutQuota?.action !== "endSurvey") {
      fullQuota = fullQuota.filter((quota) => quota.countPartialSubmissions);
      otherQuota = otherQuota.filter((quota) => quota.countPartialSubmissions);
    }

    await upsertResponseQuotaLinks(responseId, fullQuota, otherQuota, result.failedQuotas, tx);

    if (firstScreenedOutQuota?.action === "endSurvey") {
      // If the quota is full and the action is to end the survey, we need to update the response to finished
      await updateResponse(responseId, { finished: true, endingId: firstScreenedOutQuota.endingCardId }, tx);
    }

    return firstScreenedOutQuota;
  } catch (error) {
    logger.error({ error, responseId, surveyId }, "Error checking quotas full");
    return null;
  }
};
