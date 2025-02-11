import { deleteDisplay } from "@/modules/api/management/responses/[responseId]/lib/display";
import { getSurveyQuestions } from "@/modules/api/management/responses/[responseId]/lib/survey";
import { findAndDeleteUploadedFilesInResponse } from "@/modules/api/management/responses/[responseId]/lib/utils";
import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { Response } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getResponse = reactCache(async (responseId: string) =>
  cache(
    async (): Promise<Result<Response, ApiErrorResponse>> => {
      try {
        const responsePrisma = await prisma.response.findUnique({
          where: {
            id: responseId,
          },
        });

        if (!responsePrisma) {
          return err({ type: "not_found", details: [{ field: "response", issue: "not found" }] });
        }

        return ok(responsePrisma);
      } catch (error) {
        return err({
          type: "internal_server_error",
          details: [{ field: "response", issue: error.message }],
        });
      }
    },
    [`management-getResponse-${responseId}`],
    {
      tags: [responseCache.tag.byId(responseId), responseNoteCache.tag.byResponseId(responseId)],
    }
  )()
);

export const deleteResponse = async (responseId: string): Promise<Result<Response, ApiErrorResponse>> => {
  try {
    const response = await getResponse(responseId);
    if (!response.ok) {
      return response;
    }

    await prisma.response.delete({
      where: {
        id: responseId,
      },
    });

    if (response.data.displayId) {
      const deleteDisplayResult = await deleteDisplay(response.data.displayId);
      if (!deleteDisplayResult.ok) {
        return deleteDisplayResult;
      }
    }
    const surveyQuestionsResult = await getSurveyQuestions(response.data.surveyId);

    if (!surveyQuestionsResult.ok) {
      return surveyQuestionsResult;
    }

    await findAndDeleteUploadedFilesInResponse(response.data.data, surveyQuestionsResult.data.questions);

    responseCache.revalidate({
      environmentId: surveyQuestionsResult.data.environmentId,
      id: response.data.id,
      surveyId: response.data.surveyId,
    });

    responseNoteCache.revalidate({
      responseId: response.data.id,
    });

    return response;
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "response", issue: error.message }],
    });
  }
};

export const updateResponse = async (
  responseId: string,
  responseInput: Omit<Response, "id">
): Promise<Result<Response, ApiErrorResponse>> => {
  try {
    const updatedResponse = await prisma.response.update({
      where: {
        id: responseId,
      },
      data: responseInput,
    });

    responseCache.revalidate({
      id: updatedResponse.id,
      surveyId: updatedResponse.surveyId,
    });

    responseNoteCache.revalidate({
      responseId: updatedResponse.id,
    });

    return ok(updatedResponse);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "response", issue: error.message }],
    });
  }
};
