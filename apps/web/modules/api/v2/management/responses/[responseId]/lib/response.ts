import { getSurvey } from "@/lib/survey/service";
import { deleteDisplay } from "@/modules/api/v2/management/responses/[responseId]/lib/display";
import { getSurveyQuestions } from "@/modules/api/v2/management/responses/[responseId]/lib/survey";
import { findAndDeleteUploadedFilesInResponse } from "@/modules/api/v2/management/responses/[responseId]/lib/utils";
import { ZResponseUpdateSchema } from "@/modules/api/v2/management/responses/[responseId]/types/responses";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { evaluateQuotas, handleQuotas } from "@/modules/ee/quotas/lib/utils";
import { Prisma, Response } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
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

export const updateResponseWithQuotaEvaluation = async (
  responseId: string,
  responseInput: z.infer<typeof ZResponseUpdateSchema>
): Promise<Result<Response, ApiErrorResponseV2>> => {
  const responseResult = await updateResponse(responseId, responseInput);

  if (!responseResult.ok) {
    return responseResult;
  }

  const response = responseResult.data;

  try {
    const [survey, quotas] = await Promise.all([getSurvey(response.surveyId), getQuotas(response.surveyId)]);

    if (!survey || !quotas || quotas.length === 0) {
      return ok(response);
    }

    const result = evaluateQuotas(
      survey,
      response.data,
      response.variables || {},
      quotas,
      response.language || "default"
    );

    await handleQuotas(response.surveyId, response.id, result);

    return ok(response);
  } catch (error) {
    logger.error({ error, responseId: response.id }, "Error evaluating quotas for response update");
    return ok(response);
  }
};
