import { deleteDisplay } from "@/modules/api/management/responses/[responseId]/lib/display";
import { getSurveyQuestions } from "@/modules/api/management/responses/[responseId]/lib/survey";
import { findAndDeleteUploadedFilesInResponse } from "@/modules/api/management/responses/[responseId]/lib/utils";
import { Prisma, Response } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getResponse = reactCache(
  async (responseId: string): Promise<Response | null> =>
    cache(
      async () => {
        try {
          const responsePrisma = await prisma.response.findUnique({
            where: {
              id: responseId,
            },
          });

          if (!responsePrisma) {
            throw new ResourceNotFoundError("Response", responseId);
          }

          return responsePrisma;
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

export const deleteResponse = async (responseId: string): Promise<Response> => {
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

export const updateResponse = async (
  responseId: string,
  responseInput: Omit<Response, "id">
): Promise<Response> => {
  try {
    await prisma.response.update({
      where: {
        id: responseId,
      },
      data: responseInput,
    });

    const updatedResponse = await getResponse(responseId);

    if (!updatedResponse) {
      throw new ResourceNotFoundError("Response", responseId);
    }

    responseCache.revalidate({
      id: updatedResponse.id,
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
