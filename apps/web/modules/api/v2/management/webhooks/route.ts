import { NextRequest } from "next/server";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentIdFromSurveyIds } from "@/modules/api/v2/management/lib/helper";
import { resolveWorkspaceInBodyV2 } from "@/modules/api/v2/management/lib/workspace-resolver";
import { createWebhook, getWebhooks } from "@/modules/api/v2/management/webhooks/lib/webhook";
import { ZGetWebhooksFilter, ZWebhookCreateInput } from "@/modules/api/v2/management/webhooks/types/webhooks";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    schemas: {
      query: ZGetWebhooksFilter,
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
      body: ZWebhookCreateInput,
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

      if (body.surveyIds && body.surveyIds.length > 0) {
        const environmentIdResult = await getEnvironmentIdFromSurveyIds(body.surveyIds);

        if (!environmentIdResult.ok) {
          return handleApiError(request, environmentIdResult.error, auditLog);
        }
      }

      // Resolve workspaceId → production environmentId when environmentId is not provided
      const envResult = await resolveWorkspaceInBodyV2(body, authentication.environmentPermissions, "POST");
      if (!envResult.ok) {
        return handleApiError(request, envResult.error, auditLog);
      }

      const createWebhookResult = await createWebhook({
        ...body,
        environmentId: envResult.data,
      });

      if (!createWebhookResult.ok) {
        return handleApiError(request, createWebhookResult.error, auditLog);
      }

      if (auditLog) {
        auditLog.targetId = createWebhookResult.data.id;
        auditLog.newObject = createWebhookResult.data;
      }

      return responses.createdResponse(createWebhookResult);
    },
    action: "created",
    targetType: "webhook",
  });
