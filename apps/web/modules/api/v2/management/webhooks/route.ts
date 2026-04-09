import { NextRequest } from "next/server";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getWorkspaceIdFromSurveyIds } from "@/modules/api/v2/management/lib/helper";
import { resolveBodyIdsV2 } from "@/modules/api/v2/management/lib/workspace-resolver";
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

      const workspaceIds = [
        ...new Set(authentication.workspacePermissions.map((permission) => permission.workspaceId)),
      ];

      const res = await getWebhooks(workspaceIds, query);

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
    bodyTransform: async (body, auth) => {
      const resolved = await resolveBodyIdsV2(body, auth.workspacePermissions, "POST");
      if (!resolved.ok) throw resolved.error;
      return { ...body, ...resolved.data };
    },
    handler: async ({ parsedInput, auditLog }) => {
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
        const workspaceIdResult = await getWorkspaceIdFromSurveyIds(body.surveyIds);

        if (!workspaceIdResult.ok) {
          return handleApiError(request, workspaceIdResult.error, auditLog);
        }
      }

      const createWebhookResult = await createWebhook(body);

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
