import "server-only";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/v2/management/responses/lib/organization";
import { getResponsesQuery } from "@/modules/api/v2/management/responses/lib/utils";
import { TGetResponsesFilter, TResponseInput } from "@/modules/api/v2/management/responses/types/responses";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { Prisma, Response } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@formbricks/lib/posthogServer";
import { responseCache } from "@formbricks/lib/response/cache";
import { calculateTtcTotal } from "@formbricks/lib/response/utils";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const createResponse = async (
  environmentId: string,
  responseInput: TResponseInput
): Promise<Result<Response, ApiErrorResponseV2>> => {
  captureTelemetry("response created");

  const {
    surveyId,
    displayId,
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
      return err(organizationIdResult.error);
    }

    const billing = await getOrganizationBilling(organizationIdResult.data);
    if (!billing.ok) {
      return err(billing.error);
    }
    const billingData = billing.data;

    const response = await prisma.response.create({
      data: prismaData,
    });

    responseCache.revalidate({
      environmentId,
      id: response.id,
      ...(singleUseId && { singleUseId }),
      surveyId,
    });

    responseNoteCache.revalidate({
      responseId: response.id,
    });

    if (IS_FORMBRICKS_CLOUD) {
      const responsesCountResult = await getMonthlyOrganizationResponseCount(organizationIdResult.data);
      if (!responsesCountResult.ok) {
        return err(responsesCountResult.error);
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
          console.error(`Error sending plan limits reached event to Posthog: ${err}`);
        }
      }
    }

    return ok(response);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "response", issue: error.message }] });
  }
};

export const getResponses = async (
  environmentId: string,
  params: TGetResponsesFilter
): Promise<Result<ApiResponseWithMeta<Response[]>, ApiErrorResponseV2>> => {
  try {
    const [responses, count] = await prisma.$transaction([
      prisma.response.findMany({
        ...getResponsesQuery(environmentId, params),
      }),
      prisma.response.count({
        where: getResponsesQuery(environmentId, params).where,
      }),
    ]);

    if (!responses) {
      return err({ type: "not_found", details: [{ field: "responses", issue: "not found" }] });
    }

    return ok({
      data: responses,
      meta: {
        total: count,
        limit: params.limit,
        offset: params.skip,
      },
    });
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "responses", issue: error.message }] });
  }
};
