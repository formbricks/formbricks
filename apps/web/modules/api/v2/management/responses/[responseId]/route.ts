import { validateFileUploads } from "@/lib/fileValidation";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/question";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentId } from "@/modules/api/v2/management/lib/helper";
import {
  deleteResponse,
  getResponse,
  updateResponse,
} from "@/modules/api/v2/management/responses/[responseId]/lib/response";
import { getSurveyQuestions } from "@/modules/api/v2/management/responses/[responseId]/lib/survey";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { z } from "zod";
import { ZResponseIdSchema, ZResponseUpdateSchema } from "./types/responses";

export const GET = async (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ responseId: ZResponseIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;

      if (!params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "params", issue: "missing" }],
        });
      }

      const environmentIdResult = await getEnvironmentId(params.responseId, true);
      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      if (!hasPermission(authentication.environmentPermissions, environmentIdResult.data, "GET")) {
        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const response = await getResponse(params.responseId);
      if (!response.ok) {
        return handleApiError(request, response.error);
      }

      return responses.successResponse(response);
    },
  });

export const DELETE = async (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ responseId: ZResponseIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;

      if (!params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "params", issue: "missing" }],
        });
      }

      const environmentIdResult = await getEnvironmentId(params.responseId, true);
      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      if (!hasPermission(authentication.environmentPermissions, environmentIdResult.data, "DELETE")) {
        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const response = await deleteResponse(params.responseId);

      if (!response.ok) {
        return handleApiError(request, response.error);
      }

      return responses.successResponse(response);
    },
  });

export const PUT = (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedApiClient({
    request,
    externalParams: props.params,
    schemas: {
      params: z.object({ responseId: ZResponseIdSchema }),
      body: ZResponseUpdateSchema,
    },
    handler: async ({ authentication, parsedInput }) => {
      const { body, params } = parsedInput;

      if (!body || !params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: !body ? "body" : "params", issue: "missing" }],
        });
      }

      const environmentIdResult = await getEnvironmentId(params.responseId, true);
      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      if (!hasPermission(authentication.environmentPermissions, environmentIdResult.data, "PUT")) {
        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const existingResponse = await getResponse(params.responseId);

      if (!existingResponse.ok) {
        return handleApiError(request, existingResponse.error);
      }

      const questionsResponse = await getSurveyQuestions(existingResponse.data.surveyId);

      if (!questionsResponse.ok) {
        return handleApiError(request, questionsResponse.error);
      }

      if (!validateFileUploads(body.data, questionsResponse.data.questions)) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "response", issue: "Invalid file upload response" }],
        });
      }

      // Validate response data for "other" options exceeding character limit
      const otherResponseInvalidQuestionId = validateOtherOptionLengthForMultipleChoice({
        responseData: body.data,
        surveyQuestions: questionsResponse.data.questions,
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

      const response = await updateResponse(params.responseId, body);

      if (!response.ok) {
        return handleApiError(request, response.error);
      }

      return responses.successResponse(response);
    },
  });
