import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentIdFromSurveyIds } from "@/modules/api/v2/management/lib/helper";
import { createWebhook, getWebhooks } from "@/modules/api/v2/management/webhooks/lib/webhook";
import { ZGetWebhooksFilter, ZWebhookInput } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
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

      const environemntIds = authentication.environmentPermissions.map(
        (permission) => permission.environmentId
      );

      const res = await getWebhooks(environemntIds, query);

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

      if (!hasPermission(authentication.environmentPermissions, body.environmentId, "POST")) {
        return handleApiError(request, {
          type: "forbidden",
          details: [{ field: "environmentId", issue: "does not have permission to create webhook" }],
        });
      }

      const createWebhookResult = await createWebhook(body);

      if (!createWebhookResult.ok) {
        return handleApiError(request, createWebhookResult.error);
      }

      return responses.successResponse(createWebhookResult);
    },
  });
