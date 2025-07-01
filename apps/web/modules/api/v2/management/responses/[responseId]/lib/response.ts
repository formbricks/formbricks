import { deleteDisplay } from "@/modules/api/v2/management/responses/[responseId]/lib/display";
import { getSurveyQuestions } from "@/modules/api/v2/management/responses/[responseId]/lib/survey";
import { findAndDeleteUploadedFilesInResponse } from "@/modules/api/v2/management/responses/[responseId]/lib/utils";
import { ZResponseUpdateSchema } from "@/modules/api/v2/management/responses/[responseId]/types/responses";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Prisma, Response } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getResponse = reactCache(async (responseId: string) => {
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
});

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
      return { ok: false, error: surveyQuestionsResult.error as ApiErrorResponseV2 };
    }

    await findAndDeleteUploadedFilesInResponse(deletedResponse.data, surveyQuestionsResult.data.questions);

    return ok(deletedResponse);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
  responseInput: z.infer<typeof ZResponseUpdateSchema>
): Promise<Result<Response, ApiErrorResponseV2>> => {
  try {
    const updatedResponse = await prisma.response.update({
      where: {
        id: responseId,
      },
      data: responseInput,
    });

    return ok(updatedResponse);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
