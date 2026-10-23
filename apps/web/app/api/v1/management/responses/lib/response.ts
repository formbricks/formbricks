import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";
import { buildPrismaResponseData } from "@/app/api/v1/lib/utils";
import { RESPONSES_PER_PAGE } from "@/lib/constants";
import { getResponseContact } from "@/lib/response/service";
import { calculateTtcTotal } from "@/lib/response/utils";
import { getSurvey } from "@/lib/survey/service";
import { andVisibleSurveys } from "@/lib/survey/visibility/predicate";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { validateInputs } from "@/lib/utils/validate";
import {
  evaluateResponseQuotas,
  loadQuotaEvaluationContext,
} from "@/modules/ee/quotas/lib/evaluation-service";
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
          workspaceId: true,
        },
      },
    },
  },
} satisfies Prisma.ResponseSelect;

/**
 * What a create reads before its transaction opens: the workspace's organization (checked to exist) and
 * the contact the response links to. These go through the root client, so reading them inside the
 * transaction would check out a second pool connection while the transaction holds the first, and on a
 * saturated pool that read queues behind the very transaction waiting for it (ENG-3722).
 */
type TCreateResponseContext = {
  contact: { id: string; attributes: TContactAttributes } | null;
};

export const createResponseWithQuotaEvaluation = async (
  responseInput: TResponseInput
): Promise<TResponse> => {
  // Independent reads, so in parallel and before the transaction opens. The quota load never rejects (it
  // logs and returns null); evaluation checks its context against the survey of the row written.
  const [responseContext, quotaContext] = await Promise.all([
    resolveCreateResponseContext(responseInput),
    loadQuotaEvaluationContext(responseInput.surveyId),
  ]);
  const txResponse = await prisma.$transaction(async (tx) => {
    const response = await createResponse(responseInput, responseContext, tx);

    // Feed quota evaluation the language actually PERSISTED on the response (createResponse ->
    // buildPrismaResponseData canonicalizes it), so the stored value is the single source of truth and a
    // legacy code from a stale client still matches language-scoped quotas. Mirrors the v2/management path.
    const quotaResult = await evaluateResponseQuotas({
      surveyId: response.surveyId,
      responseId: response.id,
      data: responseInput.data,
      variables: responseInput.variables,
      language: response.language || "default",
      responseFinished: response.finished,
      // The row just written, so `reserved` quota operands resolve (ENG-1840).
      response,
      tx,
      quotaContext,
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

/** Maps a failure while creating a response to the errors this API has always returned. */
const handleCreateResponseError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === PrismaErrorType.RecordNotFound) {
      throw new DatabaseError("Display ID does not exist");
    }
    throw new DatabaseError(error.message);
  }

  throw error;
};

/** The reads a create needs, made before its transaction opens — see `TCreateResponseContext`. */
export const resolveCreateResponseContext = async ({
  workspaceId,
  userId,
}: Pick<TResponseInput, "workspaceId" | "userId">): Promise<TCreateResponseContext> => {
  try {
    const organization = await getOrganizationIdFromWorkspaceId(workspaceId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    return { contact: userId ? await getContactByUserId(workspaceId, userId) : null };
  } catch (error) {
    return handleCreateResponseError(error);
  }
};

export const createResponse = async (
  responseInput: TResponseInput,
  { contact }: TCreateResponseContext,
  tx?: Prisma.TransactionClient
): Promise<TResponse> => {
  validateInputs([responseInput, ZResponseInput]);

  const { finished, ttc: initialTtc } = responseInput;

  try {
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
    return handleCreateResponseError(error);
  }
};

export const getResponsesByWorkspaceIds = reactCache(
  async (
    workspaceIds: string[],
    limit?: number,
    offset?: number,
    /** ENG-3282: the API key's visibility clause on the response's survey. */
    visibleSurveyWhere: Prisma.SurveyWhereInput = {}
  ): Promise<TResponse[]> => {
    validateInputs([workspaceIds, ZId.array()], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);
    try {
      const responses = await prisma.response.findMany({
        where: {
          survey: {
            workspaceId: { in: workspaceIds },
            ...andVisibleSurveys(visibleSurveyWhere),
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

      const transformedResponses: TResponse[] = responses.map((responsePrisma) => ({
        ...responsePrisma,
        contact: getResponseContact(responsePrisma),
        tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
      }));

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

      const transformedResponses: TResponse[] = responses.map((responsePrisma) => ({
        ...responsePrisma,
        contact: getResponseContact(responsePrisma),
        tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
      }));

      return transformedResponses;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
