import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma, Response } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ValidationError } from "@formbricks/types/errors";
import { TResponse } from "@formbricks/types/responses";
import { getDisplayForResponseValidation } from "@/lib/display/service";
import { normalizeResponseLanguage } from "@/lib/response/utils";
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
      details: [
        { field: "response", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
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
                workspaceId: true,
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
      details: [
        { field: "response", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
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

    await findAndDeleteUploadedFilesInResponse(
      deletedResponse.data,
      surveyQuestionsResult.data.questions,
      surveyQuestionsResult.data.workspaceId
    );

    return ok(deletedResponse);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RelatedRecordNotFound ||
        error.code === PrismaErrorType.RecordNotFound
      ) {
        return err({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
    }

    return err({
      type: "internal_server_error",
      details: [
        { field: "response", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
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

    // ENG-1923: contactId and displayId are caller-supplied FKs mass-assigned into the update
    // below. Verify each belongs to this response's own workspace/survey before persisting — a
    // caller authorized on this response must not be able to re-point it at another tenant's
    // contact or display (cross-tenant BOLA). surveyId is not updatable (omitted from the schema),
    // so the response's workspace anchor is stable. Foreign and nonexistent ids fail identically
    // (404, generic) — no cross-tenant existence oracle.
    const existingResponse = await prismaClient.response.findUnique({
      where: { id: responseId },
      select: { surveyId: true, contactId: true, survey: { select: { workspaceId: true } } },
    });
    if (!existingResponse) {
      return err({ type: "not_found", details: [{ field: "response", issue: "not found" }] });
    }
    const workspaceId = existingResponse.survey.workspaceId;

    if (responseInput.contactId) {
      const contact = await prismaClient.contact.findUnique({
        where: { id: responseInput.contactId, workspaceId },
        select: { id: true },
      });
      if (!contact) {
        return err({ type: "not_found", details: [{ field: "contactId", issue: "not found" }] });
      }
    }

    if (responseInput.displayId) {
      const effectiveContactId =
        responseInput.contactId !== undefined ? responseInput.contactId : existingResponse.contactId;
      try {
        const display = await getDisplayForResponseValidation(responseInput.displayId, prismaClient);
        const displayValid =
          display !== null &&
          display.workspaceId === workspaceId &&
          display.surveyId === existingResponse.surveyId &&
          (display.responseId === null || display.responseId === responseId) &&
          (display.contactId === null || display.contactId === effectiveContactId);
        if (!displayValid) {
          return err({ type: "not_found", details: [{ field: "displayId", issue: "not found" }] });
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          return err({ type: "not_found", details: [{ field: "displayId", issue: "not found" }] });
        }
        throw error;
      }
    }

    const updatedResponse = await prismaClient.response.update({
      where: {
        id: responseId,
      },
      // Canonicalize the language on write (ENG-1067) — see normalizeResponseLanguage.
      data: { ...responseInput, language: normalizeResponseLanguage(responseInput.language) },
    });

    return ok(updatedResponse);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (
        error.code === PrismaErrorType.RelatedRecordNotFound ||
        error.code === PrismaErrorType.RecordNotFound
      ) {
        return err({
          type: "not_found",
          details: [{ field: "response", issue: "not found" }],
        });
      }
    }
    return err({
      type: "internal_server_error",
      details: [
        { field: "response", issue: error instanceof Error ? error.message : "Unknown error occurred" },
      ],
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
