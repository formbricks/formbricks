import { prisma } from "@formbricks/database";
import { TResponse, TResponseInput } from "@formbricks/types/v1/responses";
import { transformPrismaPerson } from "./people";

export const createResponse = async (responseInput: TResponseInput): Promise<TResponse> => {
  const responsePrisma = await prisma.response.create({
    data: {
      survey: {
        connect: {
          id: responseInput.surveyId,
        },
      },
      person: {
        connect: {
          id: responseInput.personId,
        },
      },
      finished: responseInput.finished,
      data: responseInput.data,
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

  const response: TResponse = {
    ...responsePrisma,
    createdAt: responsePrisma.createdAt.toISOString(),
    updatedAt: responsePrisma.updatedAt.toISOString(),
    person: transformPrismaPerson(responsePrisma.person),
  };

  return response;
};
