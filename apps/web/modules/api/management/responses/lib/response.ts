import "server-only";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/management/responses/lib/organization";
import { getResponsesQuery } from "@/modules/api/management/responses/lib/utils";
import { TResponseInput, TResponseNew } from "@/modules/api/management/responses/types/responses";
import { TGetResponsesFilter } from "@/modules/api/management/responses/types/responses";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@formbricks/lib/posthogServer";
import { responseCache } from "@formbricks/lib/response/cache";
import { calculateTtcTotal } from "@formbricks/lib/response/utils";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TTag } from "@formbricks/types/tags";

const responseSelectionInclude = {
  contact: {
    select: {
      id: true,
      userId: true,
    },
  },
  notes: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      text: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      isResolved: true,
      isEdited: true,
    },
  },
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ResponseInclude;

export const createResponse = async (responseInput: TResponseInput): Promise<TResponseNew> => {
  captureTelemetry("response created");

  const {
    environmentId,
    language,
    surveyId,
    displayId,
    finished,
    data,
    meta,
    singleUseId,
    variables,
    ttc: initialTtc,
    createdAt,
    updatedAt,
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
      finished: finished,
      data: data,
      language: language,
      meta: meta,
      singleUseId,
      variables: variables,
      ttc: ttc,
      createdAt,
      updatedAt,
    };

    const responsePrisma = await prisma.response.create({
      data: prismaData,
      include: responseSelectionInclude,
    });

    const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
    const organization = await getOrganizationBilling(organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    const { contact: responseContact, ...rest } = responsePrisma;

    const response: TResponseNew = {
      ...rest,
      ...(responseContact ? responseContact : {}),
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

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
  params: TGetResponsesFilter
): Promise<TResponseNew[]> => {
  const responses = await prisma.response.findMany({
    ...getResponsesQuery(environmentId, params),
    include: responseSelectionInclude,
  });

  const res = responses.map((response) => {
    const { contact, ...rest } = response;

    return {
      ...rest,
      ...(contact ? contact : {}),
      tags: response.tags.map((tag) => tag.tag),
    };
  });

  return res;
};
