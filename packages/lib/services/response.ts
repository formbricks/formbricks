import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/errors";
import { TResponse, TResponseInput, TResponseUpdateInput } from "@formbricks/types/v1/responses";
import { TTag } from "@formbricks/types/v1/tags";
import { Prisma } from "@prisma/client";
import "server-only";
import { TransformPersonOutput, getPerson, transformPrismaPerson } from "./person";
import { cache } from "react";

const responseSelection = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  finished: true,
  data: true,
  meta: true,
  personAttributes: true,
  person: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
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

export const createResponse = async (responseInput: TResponseInput): Promise<TResponse> => {
  try {
    let person: TransformPersonOutput | null = null;

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
      },
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      person: transformPrismaPerson(responsePrisma.person),
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const getResponse = async (responseId: string): Promise<TResponse | null> => {
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
      person: transformPrismaPerson(responsePrisma.person),
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const preloadSurveyResponses = (surveyId: string) => {
  void getSurveyResponses(surveyId);
};

export const getSurveyResponses = cache(async (surveyId: string): Promise<TResponse[]> => {
  try {
    const responsesPrisma = await prisma.response.findMany({
      where: {
        surveyId,
      },
      select: responseSelection,
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
    });

    const responses: TResponse[] = responsesPrisma.map((responsePrisma) => ({
      ...responsePrisma,
      person: transformPrismaPerson(responsePrisma.person),
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    }));

    return responses;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});

export const preloadEnvironmentResponses = (environmentId: string) => {
  void getEnvironmentResponses(environmentId);
};

export const getEnvironmentResponses = cache(async (environmentId: string): Promise<TResponse[]> => {
  try {
    const responsesPrisma = await prisma.response.findMany({
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
    });

    const responses: TResponse[] = responsesPrisma.map((responsePrisma) => ({
      ...responsePrisma,
      person: transformPrismaPerson(responsePrisma.person),
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    }));

    return responses;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});

export const updateResponse = async (
  responseId: string,
  responseInput: TResponseUpdateInput
): Promise<TResponse> => {
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
      person: transformPrismaPerson(responsePrisma.person),
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
