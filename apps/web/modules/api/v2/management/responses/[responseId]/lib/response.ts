import { deleteDisplay } from "@/modules/api/v2/management/responses/[responseId]/lib/display";
import { getSurveyQuestions } from "@/modules/api/v2/management/responses/[responseId]/lib/survey";
import { findAndDeleteUploadedFilesInResponse } from "@/modules/api/v2/management/responses/[responseId]/lib/utils";
import { responseUpdateSchema } from "@/modules/api/v2/management/responses/[responseId]/types/responses";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Response } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/src/types/error";
import { cache } from "@formbricks/lib/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getResponse = reactCache(async (responseId: string) =>
  cache(
    async (): Promise<Result<Response, ApiErrorResponseV2>> => {
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

export const deleteResponse = async (responseId: string): Promise<Result<Response, ApiErrorResponseV2>> => {
  try {
    const deletedResponse = await prisma.response.delete({
      where: {
        id: responseId,
      },
    });

    if (deletedResponse.displayId) {
      const deleteDisplayResult = await deleteDisplay(deletedResponse.displayId);
      if (!deleteDisplayResult.ok) {
        return deleteDisplayResult;
      }
    }
    const surveyQuestionsResult = await getSurveyQuestions(deletedResponse.surveyId);

    if (!surveyQuestionsResult.ok) {
      return surveyQuestionsResult;
    }

    await findAndDeleteUploadedFilesInResponse(deletedResponse.data, surveyQuestionsResult.data.questions);

    responseCache.revalidate({
      environmentId: surveyQuestionsResult.data.environmentId,
      id: deletedResponse.id,
      surveyId: deletedResponse.surveyId,
    });

    responseNoteCache.revalidate({
      responseId: deletedResponse.id,
    });

    return ok(deletedResponse);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [{ field: "response", issue: error.message }],
    });
  }
};

export const updateResponse = async (
  responseId: string,
  responseInput: z.infer<typeof responseUpdateSchema>
): Promise<Result<Response, ApiErrorResponseV2>> => {
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
    if (error instanceof PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RecordDoesNotExist ||
        error.code === PrismaErrorType.RelatedRecordDoesNotExist
      ) {
        return err({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
    }
    return err({
      type: "internal_server_error",
      details: [{ field: "response", issue: error.message }],
    });
  }
};
