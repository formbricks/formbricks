import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";
import { buildPrismaResponseData } from "@/app/api/v1/lib/utils";
import { RESPONSES_PER_PAGE } from "@/lib/constants";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getResponseContact } from "@/lib/response/service";
import { calculateTtcTotal } from "@/lib/response/utils";
import { getSurvey } from "@/lib/survey/service";
import { validateInputs } from "@/lib/utils/validate";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { getContactByUserId } from "./contact";

export const responseSelection = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  finished: true,
  endingId: true,
  data: true,
  meta: true,
  ttc: true,
  variables: true,
  contactAttributes: true,
  singleUseId: true,
  language: true,
  displayId: true,
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
): Promise<TResponse> => {
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

    if (quotaResult.shouldEndSurvey && quotaResult.refreshedResponse) {
      return {
        ...quotaResult.refreshedResponse,
        tags: response.tags,
        contact: response.contact,
      };
    }

    return response;
  });

  return txResponse;
};

export const createResponse = async (
  responseInput: TResponseInput,
  tx?: Prisma.TransactionClient
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

    const response: TResponse = {
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
      if (error.code === PrismaErrorType.RelatedRecordDoesNotExist) {
        throw new DatabaseError("Display ID does not exist");
      }
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponsesByEnvironmentIds = reactCache(
  async (environmentIds: string[], limit?: number, offset?: number): Promise<TResponse[]> => {
    validateInputs([environmentIds, ZId.array()], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);
    try {
      const responses = await prisma.response.findMany({
        where: {
          survey: {
            environmentId: { in: environmentIds },
          },
        },
        select: responseSelection,
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
        take: limit ? limit : undefined,
        skip: offset ? offset : undefined,
      });

      const transformedResponses: TResponse[] = await Promise.all(
        responses.map((responsePrisma) => {
          return {
            ...responsePrisma,
            contact: getResponseContact(responsePrisma),
            tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
          };
        })
      );

      return transformedResponses;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getResponses = reactCache(
  async (surveyId: string, limit?: number, offset?: number): Promise<TResponse[]> => {
    validateInputs([surveyId, ZId], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

    limit = limit ?? RESPONSES_PER_PAGE;
    const survey = await getSurvey(surveyId);
    if (!survey) return [];
    try {
      const responses = await prisma.response.findMany({
        where: { surveyId },
        select: responseSelection,
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc", // Secondary sort by ID for consistent pagination
          },
        ],
        take: limit,
        skip: offset,
      });

      const transformedResponses: TResponse[] = await Promise.all(
        responses.map((responsePrisma) => {
          return {
            ...responsePrisma,
            contact: getResponseContact(responsePrisma),
            tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
          };
        })
      );

      return transformedResponses;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
