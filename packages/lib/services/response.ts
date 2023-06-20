import { prisma } from "@formbricks/database";
import { TResponse, TResponseInput, TResponseUpdateInput } from "@formbricks/types/v1/responses";
import { Prisma } from "@prisma/client";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/errors";
import { getPerson, TransformPersonOutput, transformPrismaPerson } from "./person";

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
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        surveyId: true,
        finished: true,
        data: true,
      },
    });

    const response: TResponse = {
      ...responsePrisma,
      person,
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
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        surveyId: true,
        finished: true,
        data: true,
        personAttributes: true,
        person: {
          select: {
            id: true,
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
      },
    });

    if (!responsePrisma) {
      throw new ResourceNotFoundError("Response", responseId);
    }

    const response: TResponse = {
      ...responsePrisma,
      personAttributes: responsePrisma.personAttributes as Record<string, string | number>,
      person: transformPrismaPerson(responsePrisma.person),
    };

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

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
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        surveyId: true,
        finished: true,
        data: true,
        person: {
          select: {
            id: true,
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
      },
    });

    const response: TResponse = {
      ...responsePrisma,
      person: transformPrismaPerson(responsePrisma.person),
    };

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
