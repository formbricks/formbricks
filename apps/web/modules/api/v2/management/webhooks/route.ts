import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { authenticatedApiClient } from "@/modules/api/v2/management/auth/authenticated-api-client";
import { checkAuthorization } from "@/modules/api/v2/management/auth/check-authorization";
import { getEnvironmentIdFromSurveyIds } from "@/modules/api/v2/management/lib/helper";
import { createWebhook, getWebhooks } from "@/modules/api/v2/management/webhooks/lib/webhook";
import { ZGetWebhooksFilter, ZWebhookInput } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { NextRequest } from "next/server";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetWebhooksFilter.sourceType(),
    },
    handler: async ({ authentication, parsedInput }) => {
      const { query } = parsedInput;

      if (!query) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "query", issue: "missing" }],
        });
      }

      const environmentId = authentication.environmentId;

      const res = await getWebhooks(environmentId, query);

      if (res.ok) {
        return responses.successResponse(res.data);
      }

      return handleApiError(request, res.error);
    },
  });

export const POST = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      body: ZWebhookInput,
    },
    handler: async ({ authentication, parsedInput }) => {
      const { body } = parsedInput;

      if (!body) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "body", issue: "missing" }],
        });
      }

      const environmentIdResult = await getEnvironmentIdFromSurveyIds(body.surveyIds);

      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error);
      }

      const environmentId = environmentIdResult.data;

      if (body.environmentId !== environmentId) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "environmentId", issue: "does not match the surveys environment" }],
        });
      }

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId,
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      const createWebhookResult = await createWebhook(body);

      if (!createWebhookResult.ok) {
        return handleApiError(request, createWebhookResult.error);
      }

      return responses.successResponse(createWebhookResult);
    },
  });
