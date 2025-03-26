import "server-only";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/v2/management/responses/lib/organization";
import { getResponsesQuery } from "@/modules/api/v2/management/responses/lib/utils";
import { TGetResponsesFilter, TResponseInput } from "@/modules/api/v2/management/responses/types/responses";
import { getTeamsQuery } from "@/modules/api/v2/organizations/[organizationId]/teams/lib/utils";
import { TGetTeamsFilter } from "@/modules/api/v2/organizations/[organizationId]/teams/types/teams";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { Prisma, Response, Team } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@formbricks/lib/posthogServer";
import { responseCache } from "@formbricks/lib/response/cache";
import { calculateTtcTotal } from "@formbricks/lib/response/utils";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { logger } from "@formbricks/logger";
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
          logger.error(err, "Error sending plan limits reached event to Posthog");
        }
      }
    }

    return ok(response);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "response", issue: error.message }] });
  }
};

export const getTeams = async (
  organizationId: string,
  params: TGetTeamsFilter
): Promise<Result<ApiResponseWithMeta<Team[]>, ApiErrorResponseV2>> => {
  try {
    const [teams, count] = await prisma.$transaction([
      prisma.team.findMany({
        ...getTeamsQuery(organizationId, params),
      }),
      prisma.team.count({
        where: getTeamsQuery(organizationId, params).where,
      }),
    ]);

    if (!teams) {
      return err({ type: "not_found", details: [{ field: "teams", issue: "not found" }] });
    }

    return ok({
      data: teams,
      meta: {
        total: count,
        limit: params.limit,
        offset: params.skip,
      },
    });
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "teams", issue: error.message }] });
  }
};
