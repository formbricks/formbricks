import { prisma } from "@formbricks/database";
import { TResponse, TResponseInput, TResponseUpdateInput } from "@formbricks/types/v1/responses";
import { transformPrismaPerson } from "./person";

export const createResponse = async (responseInput: TResponseInput): Promise<TResponse> => {
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
      }),
    },
    include: {
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

  delete responsePrisma.personId;

  const response: TResponse = {
    ...responsePrisma,
    createdAt: responsePrisma.createdAt.toISOString(),
    updatedAt: responsePrisma.updatedAt.toISOString(),
    person: transformPrismaPerson(responsePrisma.person),
  };

  return response;
};

export const getResponse = async (responseId: string): Promise<TResponse | null> => {
  const responsePrisma = await prisma.response.findUnique({
    where: {
      id: responseId,
    },
    include: {
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
    return null;
  }

  delete responsePrisma.personId;

  const response: TResponse = {
    ...responsePrisma,
    createdAt: responsePrisma.createdAt.toISOString(),
    updatedAt: responsePrisma.updatedAt.toISOString(),
    person: transformPrismaPerson(responsePrisma.person),
  };

  return response;
};

export const updateResponse = async (
  responseId: string,
  responseInput: TResponseUpdateInput
): Promise<TResponse> => {
  const currentResponse = await getResponse(responseId);

  if (!currentResponse) {
    throw new Error("Response not found");
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
    include: {
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

  delete responsePrisma.personId;

  const response: TResponse = {
    ...responsePrisma,
    createdAt: responsePrisma.createdAt.toISOString(),
    updatedAt: responsePrisma.updatedAt.toISOString(),
    person: transformPrismaPerson(responsePrisma.person),
  };

  return response;
};
