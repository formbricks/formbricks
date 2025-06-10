import { validateFileUploads } from "@/lib/fileValidation";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/question";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import { getSurveyQuestions } from "@/modules/api/v2/management/responses/[responseId]/lib/survey";
import { ZGetResponsesFilter, ZResponseInput } from "@/modules/api/v2/management/responses/types/responses";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { Response } from "@prisma/client";
import { NextRequest } from "next/server";
import { createResponse, getResponses } from "./lib/response";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetResponsesFilter.sourceType(),
    },
    handler: async ({ authentication, parsedInput }) => {
      const { query } = parsedInput;

      if (!query) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "query", issue: "missing" }],
        });
      }

      const environmentIds = authentication.environmentPermissions.map(
        (permission) => permission.environmentId
      );

      const environmentResponses: Response[] = [];
      const res = await getResponses(environmentIds, query);

      if (!res.ok) {
        return handleApiError(request, res.error);
      }

      environmentResponses.push(...res.data.data);

      return responses.successResponse({ data: environmentResponses });
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

      const environmentIdResult = await getEnvironmentId(body.surveyId, false);

      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error, auditLog);
      }

      const environmentId = environmentIdResult.data;

      if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
          },
          auditLog
        );
      }

      // if there is a createdAt but no updatedAt, set updatedAt to createdAt
      if (body.createdAt && !body.updatedAt) {
        body.updatedAt = body.createdAt;
      }

      const surveyQuestions = await getSurveyQuestions(body.surveyId);
      if (!surveyQuestions.ok) {
        return handleApiError(request, surveyQuestions.error as ApiErrorResponseV2, auditLog); // NOSONAR // We need to assert or we get a type error
      }

      if (!validateFileUploads(body.data, surveyQuestions.data.questions)) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "response", issue: "Invalid file upload response" }],
          },
          auditLog
        );
      }

      // Validate response data for "other" options exceeding character limit
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

      const createResponseResult = await createResponse(environmentId, body);
      if (!createResponseResult.ok) {
        return handleApiError(request, createResponseResult.error, auditLog);
      }

      if (auditLog) {
        auditLog.targetId = createResponseResult.data.id;
        auditLog.newObject = createResponseResult.data;
      }

      return responses.createdResponse({ data: createResponseResult.data });
    },
    action: "created",
    targetType: "response",
  });
