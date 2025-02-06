import { deleteDisplay } from "@/modules/api/management/responses/[responseId]/lib/display";
import { getSurveyQuestions } from "@/modules/api/management/responses/[responseId]/lib/survey";
import { findAndDeleteUploadedFilesInResponse } from "@/modules/api/management/responses/[responseId]/lib/utils";
import { TResponseNew } from "@/modules/api/management/responses/types/responses";
import { Prisma, Response, Tag } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

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

export const getResponse = reactCache(
  async (responseId: string): Promise<TResponseNew | null> =>
    cache(
      async () => {
        try {
          const responsePrisma = await prisma.response.findUnique({
            where: {
              id: responseId,
            },
            include: responseSelectionInclude,
          });

          if (!responsePrisma) {
            throw new ResourceNotFoundError("Response", responseId);
          }

          const { contact, ...rest } = responsePrisma;

          const response: TResponseNew = {
            ...rest,
            ...(contact ? contact : {}),
            tags: responsePrisma.tags.map((tagPrisma: { tag: Tag }) => tagPrisma.tag),
          };

          return response;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`management-getResponse-${responseId}`],
      {
        tags: [responseCache.tag.byId(responseId), responseNoteCache.tag.byResponseId(responseId)],
      }
    )()
);

export const deleteResponse = async (responseId: string): Promise<TResponseNew> => {
  try {
    const response = await getResponse(responseId);
    if (!response) {
      throw new ResourceNotFoundError("Response", responseId);
    }

    await prisma.response.delete({
      where: {
        id: responseId,
      },
    });

    if (response.displayId) {
      deleteDisplay(response.displayId);
    }
    const survey = await getSurveyQuestions(response.surveyId);

    if (survey) {
      await findAndDeleteUploadedFilesInResponse(response.data, survey.questions);
    }

    responseCache.revalidate({
      environmentId: survey?.environmentId,
      id: response.id,
      contactId: response.contact?.id,
      surveyId: response.surveyId,
    });

    responseNoteCache.revalidate({
      responseId: response.id,
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const updateResponse = async (responseId: string, responseInput: Response): Promise<TResponseNew> => {
  try {
    const { id, ...responseInputWithoutId } = responseInput;
    await prisma.response.update({
      where: {
        id: responseId,
      },
      data: responseInputWithoutId,
      include: responseSelectionInclude,
    });

    const updatedResponse = await getResponse(responseId);

    if (!updatedResponse) {
      throw new ResourceNotFoundError("Response", responseId);
    }

    responseCache.revalidate({
      id: updatedResponse.id,
      contactId: updatedResponse.contact?.id,
      surveyId: updatedResponse.surveyId,
    });

    responseNoteCache.revalidate({
      responseId: updatedResponse.id,
    });

    return updatedResponse;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
