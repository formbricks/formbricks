import "server-only";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/management/responses/lib/organization";
import { getResponsesQuery } from "@/modules/api/management/responses/lib/utils";
import { TResponseInput } from "@/modules/api/management/responses/types/responses";
import { TGetResponsesFilter } from "@/modules/api/management/responses/types/responses";
import { Prisma, Response } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@formbricks/lib/posthogServer";
import { responseCache } from "@formbricks/lib/response/cache";
import { calculateTtcTotal } from "@formbricks/lib/response/utils";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const createResponse = async (
  environmentId: string,
  responseInput: TResponseInput
): Promise<Response> => {
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
    const ttc = initialTtc ? (finished ? calculateTtcTotal(initialTtc) : initialTtc) : {};

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

    const responsePrisma = await prisma.response.create({
      data: prismaData,
    });

    const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
    const organization = await getOrganizationBilling(organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const response = responsePrisma;

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
      const responsesCount = await getMonthlyOrganizationResponseCount(organizationId);
      const responsesLimit = organization.billing.limits.monthly.responses;

      if (responsesLimit && responsesCount >= responsesLimit) {
        try {
          await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
            plan: organization.billing.plan,
            limits: {
              projects: null,
              monthly: {
                responses: responsesLimit,
                miu: null,
              },
            },
          });
        } catch (err) {
          // Log error but do not throw
          console.error(`Error sending plan limits reached event to Posthog: ${err}`);
        }
      }
    }

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponses = async (
  environmentId: string,
  params?: TGetResponsesFilter
): Promise<Response[]> => {
  const responses = await prisma.response.findMany({
    ...getResponsesQuery(environmentId, params),
  });

  return responses;
};
