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
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
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
        return handleApiError(request, webhook.error as ApiErrorResponseV2);
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

      // get surveys environment
      const surveysEnvironmentId = await getEnvironmentIdFromSurveyIds(body.surveyIds);

      if (!surveysEnvironmentId.ok) {
        return handleApiError(request, surveysEnvironmentId.error, auditLog);
      }

      // get webhook environment
      const webhook = await getWebhook(params.webhookId);

      if (!webhook.ok) {
        return handleApiError(request, webhook.error as ApiErrorResponseV2, auditLog);
      }

      if (!hasPermission(authentication.environmentPermissions, webhook.data.environmentId, "PUT")) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "webhook", issue: "unauthorized" }],
          },
          auditLog
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
          auditLog
        );
      }

      const updatedWebhook = await updateWebhook(params.webhookId, body);

      if (!updatedWebhook.ok) {
        return handleApiError(request, updatedWebhook.error as ApiErrorResponseV2, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = webhook.data;
        auditLog.newObject = updatedWebhook.data;
      }

      return responses.successResponse(updatedWebhook);
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

      if (!hasPermission(authentication.environmentPermissions, webhook.data.environmentId, "DELETE")) {
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
        return handleApiError(request, deletedWebhook.error as ApiErrorResponseV2, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = webhook.data;
      }

      return responses.successResponse(deletedWebhook);
    },
    action: "deleted",
    targetType: "webhook",
  });
