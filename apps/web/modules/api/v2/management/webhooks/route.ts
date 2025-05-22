import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentIdFromSurveyIds } from "@/modules/api/v2/management/lib/helper";
import { createWebhook, getWebhooks } from "@/modules/api/v2/management/webhooks/lib/webhook";
import { ZGetWebhooksFilter, ZWebhookInput } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/utils";
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

      const auditLogBase = {
        actionType: "webhook.created" as const,
        targetType: "webhook" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: undefined,
        organizationId: authentication.organizationId,
        status: "failure" as const,
      };

      if (!body) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "body", issue: "missing" }],
          },
          auditLogBase
        );
      }

      const environmentIdResult = await getEnvironmentIdFromSurveyIds(body.surveyIds);

      if (!environmentIdResult.ok) {
        return handleApiError(request, environmentIdResult.error, auditLogBase);
      }

      if (!hasPermission(authentication.environmentPermissions, body.environmentId, "POST")) {
        return handleApiError(
          request,
          {
            type: "forbidden",
            details: [{ field: "environmentId", issue: "does not have permission to create webhook" }],
          },
          auditLogBase
        );
      }

      const createWebhookResult = await createWebhook(body);

      if (!createWebhookResult.ok) {
        return handleApiError(request, createWebhookResult.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        targetId: createWebhookResult.data.id,
        status: "success",
        newObject: createWebhookResult.data,
        eventId: request.headers.get("x-request-id") ?? undefined,
      });

      return responses.createdResponse(createWebhookResult);
    },
  });
