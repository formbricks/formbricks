import "server-only";

import { prisma } from "@formbricks/database";
import {
  TResponse,
  TResponseInput,
  TResponseUpdateInput,
  ZResponseInput,
  ZResponseUpdateInput,
} from "@formbricks/types/v1/responses";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { TPerson } from "@formbricks/types/v1/people";
import { TTag } from "@formbricks/types/v1/tags";
import { Prisma } from "@prisma/client";
import { getPerson, transformPrismaPerson } from "../person/service";
import { captureTelemetry } from "../telemetry";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/v1/environment";
import { unstable_cache } from "next/cache";
import { deleteDisplayByResponseId } from "../display/service";
import { ZString, ZOptionalNumber } from "@formbricks/types/v1/common";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { responseCache } from "./cache";
import { formatResponseDateFields } from "../response/util";

const responseSelection = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  finished: true,
  data: true,
  meta: true,
  personAttributes: true,
  singleUseId: true,
  person: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      environmentId: true,
      attributes: {
        select: {
          value: true,
          attributeClass: {
            select: {
              name: true,
            },
          },
        },
      },
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
};

export const getResponsesByPersonId = async (
  personId: string,
  page?: number
): Promise<Array<TResponse> | null> => {
  const responses = await unstable_cache(
    async () => {
      validateInputs([personId, ZId], [page, ZOptionalNumber]);

      try {
        const responsePrisma = await prisma.response.findMany({
          where: {
            personId,
          },
          select: responseSelection,
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });

        if (!responsePrisma) {
          throw new ResourceNotFoundError("Response from PersonId", personId);
        }

        let responses: Array<TResponse> = [];

        responsePrisma.forEach((response) => {
          responses.push({
            ...response,
            person: response.person ? transformPrismaPerson(response.person) : null,
            tags: response.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
          });
        });

        return responses;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getResponsesByPersonId-${personId}-${page}`],
    {
      tags: [responseCache.tag.byPersonId(personId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return responses.map((response) => ({
    ...response,
    ...formatResponseDateFields(response),
  }));
};

export const getResponseBySingleUseId = async (
  surveyId: string,
  singleUseId: string
): Promise<TResponse | null> => {
  const response = await unstable_cache(
    async () => {
      validateInputs([surveyId, ZId], [singleUseId, ZString]);

      try {
        const responsePrisma = await prisma.response.findUnique({
          where: {
            surveyId_singleUseId: { surveyId, singleUseId },
          },
          select: responseSelection,
        });

        if (!responsePrisma) {
          return null;
        }

        const response: TResponse = {
          ...responsePrisma,
          person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
          tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
        };

        return response;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getResponseBySingleUseId-${surveyId}-${singleUseId}`],
    {
      tags: [responseCache.tag.bySingleUseId(surveyId, singleUseId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  if (!response) {
    return null;
  }

  return {
    ...response,
    ...formatResponseDateFields(response),
  };
};

export const createResponse = async (responseInput: TResponseInput): Promise<TResponse> => {
  validateInputs([responseInput, ZResponseInput]);
  captureTelemetry("response created");

  try {
    let person: TPerson | null = null;

    if (responseInput.personId) {
      person = await getPerson(responseInput.personId);
    }

    const responsePrisma = await prisma.response.create({
      data: {
        survey: {
          connect: {
            id: responseInput.surveyId,
          },
        },
        finished: responseInput.finished,
        data: responseInput.data,
        ...(responseInput.personId && {
          person: {
            connect: {
              id: responseInput.personId,
            },
          },
          personAttributes: person?.attributes,
        }),
        ...(responseInput.meta && ({ meta: responseInput?.meta } as Prisma.JsonObject)),
        singleUseId: responseInput.singleUseId,
      },
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    responseCache.revalidate({
      personId: response.person?.id,
      responseId: response.id,
      surveyId: response.surveyId,
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const getResponse = async (responseId: string): Promise<TResponse | null> => {
  const response = await unstable_cache(
    async () => {
      validateInputs([responseId, ZId]);

      try {
        const responsePrisma = await prisma.response.findUnique({
          where: {
            id: responseId,
          },
          select: responseSelection,
        });

        if (!responsePrisma) {
          throw new ResourceNotFoundError("Response", responseId);
        }

        const response: TResponse = {
          ...responsePrisma,
          person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
          tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
        };

        return response;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getResponse-${responseId}`],
    { tags: [responseCache.tag.byResponseId(responseId)], revalidate: SERVICES_REVALIDATION_INTERVAL }
  )();

  if (!response) {
    return null;
  }

  return {
    ...response,
    ...formatResponseDateFields(response),
  } as TResponse;
};

export const getResponses = async (surveyId: string, page?: number): Promise<TResponse[]> => {
  const responses = await unstable_cache(
    async () => {
      validateInputs([surveyId, ZId], [page, ZOptionalNumber]);

      try {
        const responses = await prisma.response.findMany({
          where: {
            surveyId,
          },
          select: responseSelection,
          orderBy: [
            {
              createdAt: "desc",
            },
          ],
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });

        const transformedResponses: TResponse[] = responses.map((responsePrisma) => ({
          ...responsePrisma,
          person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
          tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
        }));

        return transformedResponses;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getResponses-${surveyId}`],
    {
      tags: [responseCache.tag.bySurveyId(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return responses.map((response) => ({
    ...response,
    ...formatResponseDateFields(response),
  }));
};

export const getResponsesByEnvironmentId = async (
  environmentId: string,
  page?: number
): Promise<TResponse[]> => {
  const responses = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

      try {
        const responses = await prisma.response.findMany({
          where: {
            survey: {
              environmentId,
            },
          },
          select: responseSelection,
          orderBy: [
            {
              createdAt: "desc",
            },
          ],
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });

        const transformedResponses: TResponse[] = responses.map((responsePrisma) => ({
          ...responsePrisma,
          person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
          tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
        }));

        return transformedResponses;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`getResponsesByEnvironmentId-${environmentId}`],
    {
      tags: [responseCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return responses.map((response) => ({
    ...response,
    ...formatResponseDateFields(response),
  }));
};

export const updateResponse = async (
  responseId: string,
  responseInput: TResponseUpdateInput
): Promise<TResponse> => {
  validateInputs([responseId, ZId], [responseInput, ZResponseUpdateInput]);
  try {
    const currentResponse = await getResponse(responseId);

    if (!currentResponse) {
      throw new ResourceNotFoundError("Response", responseId);
    }

    // merge data object
    const data = {
      ...currentResponse.data,
      ...responseInput.data,
    };

    const responsePrisma = await prisma.response.update({
      where: {
        id: responseId,
      },
      data: {
        finished: responseInput.finished,
        data,
      },
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    responseCache.revalidate({
      personId: response.person?.id,
      responseId: response.id,
      surveyId: response.surveyId,
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const deleteResponse = async (responseId: string): Promise<TResponse> => {
  validateInputs([responseId, ZId]);
  try {
    const responsePrisma = await prisma.response.delete({
      where: {
        id: responseId,
      },
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };
    deleteDisplayByResponseId(responseId, response.surveyId);

    responseCache.revalidate({
      personId: response.person?.id,
      responseId: response.id,
      surveyId: response.surveyId,
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const getResponseCountBySurveyId = async (surveyId: string): Promise<number> =>
  unstable_cache(
    async () => {
      validateInputs([surveyId, ZId]);

      try {
        const responseCount = await prisma.response.count({
          where: {
            surveyId: surveyId,
          },
        });
        return responseCount;
      } catch (error) {
        throw error;
      }
    },
    [`getResponseCountBySurveyId-${surveyId}`],
    {
      tags: [responseCache.tag.bySurveyId(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
