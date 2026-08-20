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

// A rejected foreign key and a nonexistent one must be indistinguishable, so every failure below
// is the same generic 404 — anything more specific would be a cross-tenant existence oracle.
const notFound = (field: string): ApiErrorResponseV2 => ({
  type: "not_found",
  details: [{ field, issue: "not found" }],
});

/** Either the request-scoped transaction client or the shared one — both satisfy these reads. */
type ResponseDbClient = Prisma.TransactionClient | typeof prisma;

/** The response's own tenant anchor, loaded once and shared by the FK checks below. */
type ResponseTenantAnchor = {
  surveyId: string;
  survey: { workspaceId: string };
};

/** Rejects a contact that is not in the response's own workspace. */
const validateContactScope = async (
  contactId: string,
  workspaceId: string,
  prismaClient: ResponseDbClient
): Promise<ApiErrorResponseV2 | null> => {
  const contact = await prismaClient.contact.findUnique({
    where: { id: contactId, workspaceId },
    select: { id: true },
  });

  return contact ? null : notFound("contactId");
};

/**
 * Rejects a display that belongs to another workspace or survey, or that is already claimed by a
 * different response. A ValidationError from the lookup means the id was malformed, which is reported
 * as not-found for the same reason as above.
 *
 * Deliberately does NOT require the display's contact to match the response's: the display is already
 * pinned to this response's workspace and survey, and a caller-supplied contactId is separately
 * scoped to the same workspace by validateContactScope, so a contact rule adds no tenant isolation
 * here. It would instead reject legitimate same-tenant edits — clearing contactId while keeping the
 * response's own display, or moving the response to another contact in the same workspace — and,
 * because the errors are deliberately uniform, report them as an undiagnosable 404 on displayId.
 * (assertDisplayOwnership enforces it on the create path, where a fresh display has no prior owner.)
 */
const validateDisplayScope = async (
  displayId: string,
  responseId: string,
  anchor: ResponseTenantAnchor,
  prismaClient: ResponseDbClient
): Promise<ApiErrorResponseV2 | null> => {
  let display: Awaited<ReturnType<typeof getDisplayForResponseValidation>>;
  try {
    display = await getDisplayForResponseValidation(displayId, prismaClient);
  } catch (error) {
    if (error instanceof ValidationError) {
      return notFound("displayId");
    }
    throw error;
  }

  const isUsable =
    display !== null &&
    display.workspaceId === anchor.survey.workspaceId &&
    display.surveyId === anchor.surveyId &&
    (display.responseId === null || display.responseId === responseId);

  return isUsable ? null : notFound("displayId");
};

/**
 * ENG-1923: contactId and displayId are caller-supplied FKs mass-assigned into the update in
 * updateResponse. When either is present, verify it belongs to this response's own workspace/survey
 * before persisting — a caller authorized on this response must not be able to re-point it at
 * another tenant's contact or display (cross-tenant BOLA). surveyId is not updatable (omitted from
 * the schema), so the response's workspace anchor is stable.
 *
 * Returns null when there is nothing to reject. When neither FK is supplied the tenant lookup is
 * skipped entirely; a missing response is still surfaced as a 404 by the update's
 * PrismaClientKnownRequestError handler.
 */
const validateResponseLinkScope = async (
  responseId: string,
  responseInput: z.infer<typeof ZResponseUpdateSchema>,
  prismaClient: ResponseDbClient
): Promise<ApiErrorResponseV2 | null> => {
  if (!responseInput.contactId && !responseInput.displayId) {
    return null;
  }

  const anchor = await prismaClient.response.findUnique({
    where: { id: responseId },
    select: { surveyId: true, survey: { select: { workspaceId: true } } },
  });
  if (!anchor) {
    return notFound("response");
  }

  if (responseInput.contactId) {
    const contactError = await validateContactScope(
      responseInput.contactId,
      anchor.survey.workspaceId,
      prismaClient
    );
    if (contactError) {
      return contactError;
    }
  }

  if (!responseInput.displayId) {
    return null;
  }

  return validateDisplayScope(responseInput.displayId, responseId, anchor, prismaClient);
};

export const updateResponse = async (
  responseId: string,
  responseInput: z.infer<typeof ZResponseUpdateSchema>,
  tx?: Prisma.TransactionClient
): Promise<Result<Response, ApiErrorResponseV2>> => {
  try {
    const prismaClient = tx ?? prisma;

    const linkScopeError = await validateResponseLinkScope(responseId, responseInput, prismaClient);
    if (linkScopeError) {
      return err(linkScopeError);
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
      // The row just written, so `reserved` quota operands resolve (ENG-1840).
      response,
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
