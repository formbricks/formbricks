import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma, Response } from "@formbricks/database/generated/client";
import { logger } from "@formbricks/logger";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@/lib/posthogServer";
import { calculateTtcTotal } from "@/lib/response/utils";
import { captureTelemetry } from "@/lib/telemetry";
import { getContactByUserId } from "@/modules/api/v2/management/responses/lib/contact";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/v2/management/responses/lib/organization";
import { getResponsesQuery } from "@/modules/api/v2/management/responses/lib/utils";
import { TGetResponsesFilter, TResponseInput } from "@/modules/api/v2/management/responses/types/responses";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";

export const getResponses = async (
  environmentIds: string[],
  params: TGetResponsesFilter
): Promise<Result<ApiResponseWithMeta<Response[]>, ApiErrorResponseV2>> => {
  try {
    const query = getResponsesQuery(environmentIds, params);
    const whereClause = query.where;

    const [responses, totalCount] = await Promise.all([
      prisma.response.findMany(query),
      prisma.response.count({ where: whereClause }),
    ]);

    return ok({
      data: responses,
      meta: {
        total: totalCount,
        limit: params.limit,
        offset: params.skip,
      },
    });
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "responses", issue: error.message }] });
  }
};

export const createResponse = async (
  environmentId: string,
  responseInput: TResponseInput,
  tx?: Prisma.TransactionClient
): Promise<Result<Response, ApiErrorResponseV2>> => {
  captureTelemetry("response created");

  const {
    surveyId,
    displayId,
    userId,
    finished,
    data,
    language,
    meta,
    singleUseId,
    variables,
    ttc: initialTtc,
    createdAt,
    updatedAt,
    endingId,
  } = responseInput;

  try {
    let contact: { id: string; attributes: TContactAttributes } | null = null;

    // If userId is provided, look up the contact by userId
    if (userId) {
      const contactResult = await getContactByUserId(environmentId, userId);
      if (!contactResult.ok) {
        return err(contactResult.error);
      }
      contact = contactResult.data;
    }

    let ttc = {};
    if (initialTtc) {
      if (finished) {
        ttc = calculateTtcTotal(initialTtc);
      } else {
        ttc = initialTtc;
      }
    }

    const prismaData: Prisma.ResponseCreateInput = {
      survey: {
        connect: {
          id: surveyId,
        },
      },
      display: displayId ? { connect: { id: displayId } } : undefined,
      ...(contact?.id && {
        contact: {
          connect: {
            id: contact.id,
          },
        },
        contactAttributes: contact.attributes,
      }),
      finished,
      data,
      language,
      meta,
      singleUseId,
      variables,
      ttc,
      createdAt,
      updatedAt,
      endingId,
    };

    const organizationIdResult = await getOrganizationIdFromEnvironmentId(environmentId);
    if (!organizationIdResult.ok) {
      return err(organizationIdResult.error as ApiErrorResponseV2);
    }

    const billing = await getOrganizationBilling(organizationIdResult.data);
    if (!billing.ok) {
      return err(billing.error as ApiErrorResponseV2);
    }
    const billingData = billing.data;

    const prismaClient = tx ?? prisma;

    const response = await prismaClient.response.create({
      data: prismaData,
    });

    if (IS_FORMBRICKS_CLOUD) {
      const responsesCountResult = await getMonthlyOrganizationResponseCount(organizationIdResult.data);
      if (!responsesCountResult.ok) {
        return err(responsesCountResult.error as ApiErrorResponseV2);
      }

      const responsesCount = responsesCountResult.data;
      const responsesLimit = billingData.limits?.monthly.responses;

      if (responsesLimit && responsesCount >= responsesLimit) {
        try {
          await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
            plan: billingData.plan,
            limits: {
              projects: null,
              monthly: {
                responses: responsesLimit,
                miu: null,
              },
            },
          });
        } catch (err) {
          // Log error but do not throw it
          logger.error(err, "Error sending plan limits reached event to Posthog");
        }
      }
    }

    return ok(response);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "response", issue: error.message }] });
  }
};

export const createResponseWithQuotaEvaluation = async (
  environmentId: string,
  responseInput: TResponseInput
): Promise<Result<Response, ApiErrorResponseV2>> => {
  const txResponse = await prisma.$transaction<Result<Response, ApiErrorResponseV2>>(async (tx) => {
    const responseResult = await createResponse(environmentId, responseInput, tx);
    if (!responseResult.ok) {
      return responseResult;
    }

    const response = responseResult.data;

    const quotaResult = await evaluateResponseQuotas({
      surveyId: responseInput.surveyId,
      responseId: response.id,
      data: responseInput.data,
      variables: responseInput.variables,
      language: responseInput.language || "default",
      responseFinished: response.finished,
      tx,
    });

    if (quotaResult.shouldEndSurvey) {
      if (quotaResult.refreshedResponse) {
        return ok(quotaResult.refreshedResponse);
      }

      return ok({
        ...response,
        finished: true,
        ...(quotaResult.quotaFull?.endingCardId && {
          endingId: quotaResult.quotaFull.endingCardId,
        }),
      });
    }

    return ok(response);
  });

  return txResponse;
};
