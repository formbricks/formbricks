import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";
import { buildPrismaResponseData } from "@/app/api/v1/lib/utils";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { calculateTtcTotal } from "@/lib/response/utils";
import { validateInputs } from "@/lib/utils/validate";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
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

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
