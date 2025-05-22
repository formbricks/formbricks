import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getEnvironmentIdFromSurveyIds } from "@/modules/api/v2/management/lib/helper";
import {
  deleteWebhook,
  getWebhook,
  updateWebhook,
} from "@/modules/api/v2/management/webhooks/[webhookId]/lib/webhook";
import {
  ZWebhookIdSchema,
  ZWebhookUpdateSchema,
} from "@/modules/api/v2/management/webhooks/[webhookId]/types/webhooks";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/utils";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";
import { z } from "zod";

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
        return handleApiError(request, webhook.error);
      }

      if (!hasPermission(authentication.environmentPermissions, webhook.data.environmentId, "GET")) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "webhook", issue: "unauthorized" }],
        });
      }

      return responses.successResponse(webhook);
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
    handler: async ({ authentication, parsedInput }) => {
      const { params, body } = parsedInput;
      const auditLogBase = {
        actionType: "webhook.updated" as const,
        targetType: "webhook" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: params?.webhookId,
        organizationId: authentication.organizationId,
        status: "failure" as const,
        apiUrl: request.url,
      };

      if (!body || !params) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: !body ? "body" : "params", issue: "missing" }],
          },
          auditLogBase
        );
      }

      // get surveys environment
      const surveysEnvironmentId = await getEnvironmentIdFromSurveyIds(body.surveyIds);

      if (!surveysEnvironmentId.ok) {
        return handleApiError(request, surveysEnvironmentId.error, auditLogBase);
      }

      // get webhook environment
      const webhook = await getWebhook(params.webhookId);

      if (!webhook.ok) {
        return handleApiError(request, webhook.error, auditLogBase);
      }

      if (!hasPermission(authentication.environmentPermissions, webhook.data.environmentId, "PUT")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "webhook", issue: "unauthorized" }],
          },
          auditLogBase
        );
      }

      // check if webhook environment matches the surveys environment
      if (webhook.data.environmentId !== surveysEnvironmentId.data) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [
              { field: "surveys id", issue: "webhook environment does not match the surveys environment" },
            ],
          },
          auditLogBase
        );
      }

      const updatedWebhook = await updateWebhook(params.webhookId, body);

      if (!updatedWebhook.ok) {
        return handleApiError(request, updatedWebhook.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        status: "success",
        newObject: updatedWebhook.data,
        oldObject: webhook.data,
        eventId: request.headers.get("x-request-id") ?? undefined,
      });

      return responses.successResponse(updatedWebhook);
    },
  });

export const DELETE = async (request: NextRequest, props: { params: Promise<{ webhookId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ webhookId: ZWebhookIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;
      const auditLogBase = {
        actionType: "webhook.deleted" as const,
        targetType: "webhook" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: params?.webhookId,
        organizationId: authentication.organizationId,
        status: "failure" as const,
        apiUrl: request.url,
      };

      if (!params) {
        return handleApiError(
          request,
          {
            type: "bad_request",
            details: [{ field: "params", issue: "missing" }],
          },
          auditLogBase
        );
      }

      const webhook = await getWebhook(params.webhookId);

      if (!webhook.ok) {
        return handleApiError(request, webhook.error, auditLogBase);
      }

      if (!hasPermission(authentication.environmentPermissions, webhook.data.environmentId, "DELETE")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "webhook", issue: "unauthorized" }],
          },
          auditLogBase
        );
      }

      const deletedWebhook = await deleteWebhook(params.webhookId);

      if (!deletedWebhook.ok) {
        return handleApiError(request, deletedWebhook.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        status: "success",
        oldObject: webhook.data,
        eventId: request.headers.get("x-request-id") ?? undefined,
      });

      return responses.successResponse(deletedWebhook);
    },
  });
