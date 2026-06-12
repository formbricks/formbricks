import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getWorkspaceIdFromSurveyIds } from "@/modules/api/v2/management/lib/helper";
import {
  deleteWebhook,
  getWebhook,
  updateWebhook,
} from "@/modules/api/v2/management/webhooks/[webhookId]/lib/webhook";
import {
  ZWebhookIdSchema,
  ZWebhookUpdateSchema,
} from "@/modules/api/v2/management/webhooks/[webhookId]/types/webhooks";
import { removeSecretFromWebhook } from "@/modules/api/v2/management/webhooks/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const GET = async (request: NextRequest, props: { params: Promise<{ webhookId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ webhookId: ZWebhookIdSchema }),
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

      const webhook = await getWebhook(params.webhookId);

      if (!webhook.ok) {
        return handleApiError(request, webhook.error as ApiErrorResponseV2);
      }

      if (!hasPermission(authentication.workspacePermissions, webhook.data.workspaceId, "GET")) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "webhook", issue: "unauthorized" }],
        });
      }

      return responses.successResponse({ data: removeSecretFromWebhook(webhook.data) });
    },
  });

export const PUT = async (request: NextRequest, props: { params: Promise<{ webhookId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ webhookId: ZWebhookIdSchema }),
      body: ZWebhookUpdateSchema,
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params, body } = parsedInput;
      if (auditLog) {
        auditLog.targetId = params?.webhookId;
      }

      if (!body || !params) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: !body ? "body" : "params", issue: "missing" }],
          },
          auditLog
        );
      }

      const surveysWorkspaceIdResult = await getWorkspaceIdFromSurveyIds(body.surveyIds);

      if (!surveysWorkspaceIdResult.ok) {
        return handleApiError(request, surveysWorkspaceIdResult.error, auditLog);
      }

      const surveysWorkspaceId = surveysWorkspaceIdResult.data;

      // get webhook workspace
      const webhook = await getWebhook(params.webhookId);

      if (!webhook.ok) {
        return handleApiError(request, webhook.error as ApiErrorResponseV2, auditLog);
      }

      if (!hasPermission(authentication.workspacePermissions, webhook.data.workspaceId, "PUT")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "webhook", issue: "unauthorized" }],
          },
          auditLog
        );
      }

      // check if webhook workspace matches the surveys workspace
      if (surveysWorkspaceId && webhook.data.workspaceId !== surveysWorkspaceId) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [
              { field: "surveyIds", issue: "webhook workspace does not match the surveys workspace" },
            ],
          },
          auditLog
        );
      }

      const updatedWebhook = await updateWebhook(params.webhookId, body);

      if (!updatedWebhook.ok) {
        return handleApiError(request, updatedWebhook.error as ApiErrorResponseV2, auditLog); // NOSONAR // We need to assert or we get a type error
      }

      if (auditLog) {
        auditLog.oldObject = webhook.data;
        auditLog.newObject = updatedWebhook.data;
      }

      return responses.successResponse({ data: removeSecretFromWebhook(updatedWebhook.data) });
    },
    action: "updated",
    targetType: "webhook",
  });

export const DELETE = async (request: NextRequest, props: { params: Promise<{ webhookId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ webhookId: ZWebhookIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput, auditLog }) => {
      const { params } = parsedInput;
      if (auditLog) {
        auditLog.targetId = params?.webhookId;
      }

      if (!params) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "params", issue: "missing" }],
          },
          auditLog
        );
      }

      const webhook = await getWebhook(params.webhookId);

      if (!webhook.ok) {
        return handleApiError(request, webhook.error as ApiErrorResponseV2, auditLog);
      }

      if (!hasPermission(authentication.workspacePermissions, webhook.data.workspaceId, "DELETE")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "webhook", issue: "unauthorized" }],
          },
          auditLog
        );
      }

      const deletedWebhook = await deleteWebhook(params.webhookId);

      if (!deletedWebhook.ok) {
        return handleApiError(request, deletedWebhook.error as ApiErrorResponseV2, auditLog); // NOSONAR // We need to assert or we get a type error
      }

      if (auditLog) {
        auditLog.oldObject = webhook.data;
      }

      return responses.successResponse({ data: removeSecretFromWebhook(deletedWebhook.data) });
    },
    action: "deleted",
    targetType: "webhook",
  });
