import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { sendToPipeline } from "@/app/lib/pipelines";
import { can } from "@/lib/authorization";
import { getWorkspaceAuthorizationActionForMethod } from "@/lib/authorization/permission-action";
import { getWorkspaceLegacyStoragePrefixes } from "@/lib/workspace/service";
import { formatValidationErrorsForV2Api, validateResponseData } from "@/modules/api/lib/validation";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/element";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getAuthorizedApiKeyWorkspaceIds } from "@/modules/api/v2/management/lib/authorized-workspace-ids";
import { getWorkspaceId } from "@/modules/api/v2/management/lib/helper";
import { getResponseForPipeline } from "@/modules/api/v2/management/responses/[responseId]/lib/response";
import { getSurveyQuestions } from "@/modules/api/v2/management/responses/[responseId]/lib/survey";
import { ZGetResponsesFilter, ZResponseInput } from "@/modules/api/v2/management/responses/types/responses";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { resolveStorageUrlsInObject, validateClientFileUploads } from "@/modules/storage/utils";
import { createResponseWithQuotaEvaluation, getResponses } from "./lib/response";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetResponsesFilter,
    },
    handler: async ({ authentication, parsedInput }) => {
      const { query } = parsedInput;

      if (!query) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "query", issue: "missing" }],
        });
      }

      const workspaceIds = await getAuthorizedApiKeyWorkspaceIds(authentication);

      const res = await getResponses(workspaceIds, query);

      if (!res.ok) {
        return handleApiError(request, res.error);
      }

      return responses.successResponse({
        data: res.data.data.map((r) => ({ ...r, data: resolveStorageUrlsInObject(r.data) })),
        meta: res.data.meta,
      });
    },
  });

export const POST = async (request: Request) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZResponseInput,
    },
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { body } = parsedInput;

      if (!body) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "body", issue: "missing" }],
          },
          auditLog
        );
      }

      const workspaceIdResult = await getWorkspaceId(body.surveyId, false);

      if (!workspaceIdResult.ok) {
        return handleApiError(request, workspaceIdResult.error, auditLog);
      }

      const { workspaceId } = workspaceIdResult.data;

      if (
        !(await can(
          { type: "apiKey", id: authentication.apiKeyId },
          getWorkspaceAuthorizationActionForMethod("POST"),
          { type: "workspace", id: workspaceId }
        ))
      ) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
          },
          auditLog
        );
      }

      if (body.createdAt && !body.updatedAt) {
        body.updatedAt = body.createdAt;
      }

      const surveyQuestions = await getSurveyQuestions(body.surveyId);
      if (!surveyQuestions.ok) {
        return handleApiError(request, surveyQuestions.error as ApiErrorResponseV2, auditLog); // NOSONAR
      }

      if (
        !validateClientFileUploads({
          data: body.data,
          workspaceId,
          surveyId: body.surveyId,
          blocks: surveyQuestions.data.blocks,
          questions: surveyQuestions.data.questions,
          // Management callers replay stored responses whose file URLs may predate the scoped shape;
          // accept those against a prefix this workspace owns (ENG-1981 review).
          legacyOwnedStoragePrefixes: await getWorkspaceLegacyStoragePrefixes(workspaceId),
        })
      ) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [
              {
                field: "response",
                issue:
                  "Invalid file upload response: each file URL must reference a file uploaded to this survey's file-upload element",
              },
            ],
          },
          auditLog
        );
      }

      const otherResponseInvalidQuestionId = validateOtherOptionLengthForMultipleChoice({
        responseData: body.data,
        surveyQuestions: surveyQuestions.data.questions,
        responseLanguage: body.language ?? undefined,
      });

      if (otherResponseInvalidQuestionId) {
        return handleApiError(request, {
          type: "bad_request",
          details: [
            {
              field: "response",
              issue: `Response for question ${otherResponseInvalidQuestionId} exceeds character limit`,
              meta: {
                questionId: otherResponseInvalidQuestionId,
              },
            },
          ],
        });
      }

      const validationErrors = validateResponseData(
        surveyQuestions.data.blocks,
        body.data,
        body.language ?? "en",
        surveyQuestions.data.questions
      );

      if (validationErrors) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: formatValidationErrorsForV2Api(validationErrors),
          },
          auditLog
        );
      }

      const createResponseResult = await createResponseWithQuotaEvaluation(workspaceId, body);
      if (!createResponseResult.ok) {
        return handleApiError(request, createResponseResult.error, auditLog);
      }

      // Fire-and-forget by design (the other response endpoints await the enqueue), but a failure here
      // loses every webhook, integration and email for the response — it must at least be visible.
      const pipelineLogContext = {
        responseId: createResponseResult.data.id,
        surveyId: body.surveyId,
        workspaceId,
      };
      getResponseForPipeline(createResponseResult.data.id)
        .then((createdResponseForPipeline) => {
          if (!createdResponseForPipeline.ok) {
            logger.error(
              { ...pipelineLogContext, error: createdResponseForPipeline.error },
              "Response pipeline skipped: could not load the created response"
            );
            return;
          }

          sendToPipeline({
            event: "responseCreated",
            workspaceId,
            surveyId: body.surveyId,
            response: createdResponseForPipeline.data,
          }).catch((error: unknown) => {
            logger.error(
              { ...pipelineLogContext, err: error, event: "responseCreated" },
              "Response pipeline enqueue failed"
            );
          });

          if (createResponseResult.data.finished) {
            sendToPipeline({
              event: "responseFinished",
              workspaceId,
              surveyId: body.surveyId,
              response: createdResponseForPipeline.data,
            }).catch((error: unknown) => {
              logger.error(
                { ...pipelineLogContext, err: error, event: "responseFinished" },
                "Response pipeline enqueue failed"
              );
            });
          }
        })
        .catch((error: unknown) => {
          logger.error(
            { ...pipelineLogContext, err: error },
            "Response pipeline skipped: could not load the created response"
          );
        });

      if (auditLog) {
        auditLog.targetId = createResponseResult.data.id;
        auditLog.newObject = createResponseResult.data;
      }

      return responses.createdResponse({ data: createResponseResult.data });
    },
    action: "created",
    targetType: "response",
  });
