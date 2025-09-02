import "server-only";
import { updateResponse } from "@/lib/response/service";
import { evaluateLogic } from "@/lib/surveyLogic/utils";
import { validateInputs } from "@/lib/utils/validate";
import { prisma } from "@formbricks/database";
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
 */
export const upsertResponseQuotaLinks = async (
  responseId: string,
  fullQuota: TSurveyQuota[],
  otherQuota: TSurveyQuota[],
  failedQuotas: TSurveyQuota[]
): Promise<void> => {
  await prisma.responseQuotaLink.deleteMany({
    where: {
      responseId,
      quotaId: { in: failedQuotas.map((quota) => quota.id) },
    },
  });

  const fullQuotaIds = fullQuota.map((quota) => quota.id);
  const otherQuotaIds = otherQuota.map((quota) => quota.id);

  const upsertPromises = await Promise.all([
    // Create new records for full quotas
    prisma.responseQuotaLink.createMany({
      data: fullQuotaIds.map((quotaId) => ({
        responseId,
        quotaId,
        status: "screenedOut",
      })),
      skipDuplicates: true,
    }),

    // Update existing records for full quotas
    prisma.responseQuotaLink.updateMany({
      where: {
        responseId,
        quotaId: { in: fullQuotaIds },
        status: { not: "screenedOut" },
      },
      data: {
        status: "screenedOut",
      },
    }),

    // Create new records for other quotas
    prisma.responseQuotaLink.createMany({
      data: otherQuotaIds.map((quotaId) => ({
        responseId,
        quotaId,
        status: "screenedIn",
      })),
      skipDuplicates: true,
    }),
  ]);

  await upsertPromises;
};

/**
 * Checks if any quota is full and returns the appropriate quota-full response
 * @param surveyId - Survey ID to check quotas for
 * @param responseId - Response ID to check quotas for
 * @param result - Current evaluation results
 * @returns Quota-full response if any quota is full, null otherwise
 */
export const handleQuotas = async (
  surveyId: string,
  responseId: string,
  result: { passedQuotas: TSurveyQuota[]; failedQuotas: TSurveyQuota[] }
): Promise<TSurveyQuota | null> => {
  try {
    validateInputs([surveyId, ZId], [responseId, ZId]);

    let firstScreenedOutQuota: TSurveyQuota | null = null;
    const fullQuota: TSurveyQuota[] = [];
    const otherQuota: TSurveyQuota[] = [];

    const quotasCountingAll = result.passedQuotas.filter((quota) => quota.countPartialSubmissions);
    const quotasCountingFinished = result.passedQuotas.filter((quota) => !quota.countPartialSubmissions);

    type QuotaCountResult = { quotaId: string; _count: { responseId: number } };

    const [countsForAll, countsForFinished] = await Promise.all([
      quotasCountingAll.length > 0
        ? prisma.responseQuotaLink.groupBy({
            by: ["quotaId"],
            where: {
              quotaId: { in: quotasCountingAll.map((q) => q.id) },
              status: "screenedIn",
            },
            _count: {
              responseId: true,
            },
          })
        : ([] as QuotaCountResult[]),
      quotasCountingFinished.length > 0
        ? prisma.responseQuotaLink.groupBy({
            by: ["quotaId"],
            where: {
              quotaId: { in: quotasCountingFinished.map((q) => q.id) },
              status: "screenedIn",
              response: { finished: true },
            },
            _count: {
              responseId: true,
            },
          })
        : ([] as QuotaCountResult[]),
    ]);

    const quotaCounts = new Map<string, number>();

    countsForAll.forEach((result) => {
      quotaCounts.set(result.quotaId, result._count.responseId);
    });

    countsForFinished.forEach((result) => {
      quotaCounts.set(result.quotaId, result._count.responseId);
    });

    for (const quota of result.passedQuotas) {
      const screenedInCount = quotaCounts.get(quota.id) ?? 0;

      if (screenedInCount >= quota.limit) {
        firstScreenedOutQuota ??= quota;
        fullQuota.push(quota);
      } else {
        otherQuota.push(quota);
      }
    }

    await upsertResponseQuotaLinks(responseId, fullQuota, otherQuota, result.failedQuotas);

    if (firstScreenedOutQuota?.action === "endSurvey") {
      // If the quota is full and the action is to end the survey, we need to update the response to finished
      await updateResponse(responseId, { finished: true, endingId: firstScreenedOutQuota.endingCardId });
    }

    return firstScreenedOutQuota;
  } catch (error) {
    logger.error({ error, responseId, surveyId }, "Error checking quotas full");
    return null;
  }
};
