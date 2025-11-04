import { Prisma, Response } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TResponse } from "@formbricks/types/responses";
import { deleteDisplay } from "@/modules/api/v2/management/responses/[responseId]/lib/display";
import { getSurveyQuestions } from "@/modules/api/v2/management/responses/[responseId]/lib/survey";
import { findAndDeleteUploadedFilesInResponse } from "@/modules/api/v2/management/responses/[responseId]/lib/utils";
import { ZResponseUpdateSchema } from "@/modules/api/v2/management/responses/[responseId]/types/responses";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";

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

export const getResponseForPipeline = async (
  responseId: string
): Promise<Result<TResponse, ApiErrorResponseV2>> => {
  try {
    const responsePrisma = await prisma.response.findUnique({
      where: {
        id: responseId,
      },
      include: {
        contact: {
          select: {
            id: true,
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
      },
    });

    if (!responsePrisma) {
      return err({ type: "not_found", details: [{ field: "response", issue: "not found" }] });
    }

    return ok({
      ...responsePrisma,
      contact: responsePrisma.contact
        ? {
            id: responsePrisma.contact.id,
            userId: responsePrisma.contactAttributes?.userId,
          }
        : null,
      tags: responsePrisma.tags.map((t) => t.tag),
    });
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "response", issue: error.message }],
    });
  }
};

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
  responseInput: z.infer<typeof ZResponseUpdateSchema>,
  tx?: Prisma.TransactionClient
): Promise<Result<Response, ApiErrorResponseV2>> => {
  try {
    const prismaClient = tx ?? prisma;
    const updatedResponse = await prismaClient.response.update({
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
  const txResponse = await prisma.$transaction<Result<Response, ApiErrorResponseV2>>(async (tx) => {
    const responseResult = await updateResponse(responseId, responseInput, tx);

    if (!responseResult.ok) {
      return responseResult;
    }

    const response = responseResult.data;

    const quotaResult = await evaluateResponseQuotas({
      surveyId: response.surveyId,
      responseId: response.id,
      data: response.data,
      variables: response.variables,
      language: response.language || "default",
      responseFinished: response.finished,
      tx,
    });

    if (quotaResult.shouldEndSurvey) {
      if (quotaResult.refreshedResponse) {
        return ok(quotaResult.refreshedResponse);
      }

      return ok({
        ...response,
        finished: true,
        ...(quotaResult.quotaFull?.endingCardId && {
          endingId: quotaResult.quotaFull.endingCardId,
        }),
      });
    }

    return ok(response);
  });

  return txResponse;
};
