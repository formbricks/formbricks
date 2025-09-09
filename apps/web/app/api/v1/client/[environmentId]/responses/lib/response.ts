import "server-only";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@/lib/organization/service";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@/lib/posthogServer";
import { calculateTtcTotal } from "@/lib/response/utils";
import { captureTelemetry } from "@/lib/telemetry";
import { validateInputs } from "@/lib/utils/validate";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { Organization, Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";
import { getContactByUserId } from "./contact";

export const responseSelection = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  finished: true,
  data: true,
  meta: true,
  ttc: true,
  variables: true,
  contactAttributes: true,
  singleUseId: true,
  language: true,
  displayId: true,
  endingId: true,
  contact: {
    select: {
      id: true,
      attributes: {
        select: { attributeKey: true, value: true },
      },
    },
  },
  tags: {
    select: {
      tag: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          name: true,
          environmentId: true,
        },
      },
    },
  },
} satisfies Prisma.ResponseSelect;

const buildPrismaResponseData = (
  responseInput: TResponseInput,
  contact: { id: string; attributes: TContactAttributes } | null,
  ttc: Record<string, number>
): Prisma.ResponseCreateInput => {
  const {
    surveyId,
    displayId,
    finished,
    data,
    language,
    meta,
    singleUseId,
    variables,
    createdAt,
    updatedAt,
  } = responseInput;

  return {
    survey: {
      connect: {
        id: surveyId,
      },
    },
    display: displayId ? { connect: { id: displayId } } : undefined,
    finished: finished,
    data: data,
    language: language,
    ...(contact?.id && {
      contact: {
        connect: {
          id: contact.id,
        },
      },
      contactAttributes: contact.attributes,
    }),
    ...(meta && ({ meta } as Prisma.JsonObject)),
    singleUseId,
    ...(variables && { variables }),
    ttc: ttc,
    createdAt,
    updatedAt,
  };
};

const handleBillingLimitsCheck = async (
  environmentId: string,
  organizationId: string,
  organizationBilling: Organization["billing"]
): Promise<void> => {
  if (!IS_FORMBRICKS_CLOUD) return;

  const responsesCount = await getMonthlyOrganizationResponseCount(organizationId);
  const responsesLimit = organizationBilling.limits.monthly.responses;

  if (responsesLimit && responsesCount >= responsesLimit) {
    try {
      await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
        plan: organizationBilling.plan,
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
      logger.error(err, "Error sending plan limits reached event to Posthog");
    }
  }
};

export const createResponseWithQuotaEvaluation = async (
  responseInput: TResponseInput
): Promise<TResponseWithQuotaFull> => {
  const txResponse = await prisma.$transaction(async (tx) => {
    const response = await createResponse(responseInput, tx);

    const quotaResult = await evaluateResponseQuotas({
      surveyId: responseInput.surveyId,
      responseId: response.id,
      data: responseInput.data,
      variables: responseInput.variables,
      language: responseInput.language,
      responseFinished: response.finished,
      tx,
    });

    return {
      ...response,
      ...(quotaResult.quotaFull && { quotaFull: quotaResult.quotaFull }),
    };
  });

  return txResponse;
};

export const createResponse = async (
  responseInput: TResponseInput,
  tx: Prisma.TransactionClient
): Promise<TResponse> => {
  validateInputs([responseInput, ZResponseInput]);
  captureTelemetry("response created");

  const { environmentId, userId, finished, ttc: initialTtc } = responseInput;

  try {
    let contact: { id: string; attributes: TContactAttributes } | null = null;

    const organization = await getOrganizationByEnvironmentId(environmentId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", environmentId);
    }

    if (userId) {
      contact = await getContactByUserId(environmentId, userId);
    }

    const ttc = initialTtc ? (finished ? calculateTtcTotal(initialTtc) : initialTtc) : {};

    const prismaData = buildPrismaResponseData(responseInput, contact, ttc);

    const prismaClient = tx ?? prisma;

    const responsePrisma = await prismaClient.response.create({
      data: prismaData,
      select: responseSelection,
    });

    const response = {
      ...responsePrisma,
      contact: contact
        ? {
            id: contact.id,
            userId: contact.attributes.userId,
          }
        : null,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    await handleBillingLimitsCheck(environmentId, organization.id, organization.billing);

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
