import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { authenticatedApiClient } from "@/modules/api/v2/management/auth/authenticated-api-client";
import { checkAuthorization } from "@/modules/api/v2/management/auth/check-authorization";
import { getEnvironmentIdFromSurveyIds } from "@/modules/api/v2/management/lib/helper";
import {
  deleteWebhook,
  getWebhook,
  updateWebhook,
} from "@/modules/api/v2/management/webhooks/[webhookId]/lib/webhook";
import {
  webhookIdSchema,
  webhookUpdateSchema,
} from "@/modules/api/v2/management/webhooks/[webhookId]/types/webhooks";
import { NextRequest } from "next/server";
import { z } from "zod";

export const GET = async (request: NextRequest, props: { params: Promise<{ webhookId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ webhookId: webhookIdSchema }),
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

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId: webhook.ok ? webhook.data.environmentId : "",
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      return responses.successResponse(webhook);
    },
  });

export const PUT = async (request: NextRequest, props: { params: Promise<{ webhookId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ webhookId: webhookIdSchema }),
      body: webhookUpdateSchema,
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params, body } = parsedInput;

      if (!body || !params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: !body ? "body" : "params", issue: "missing" }],
        });
      }

      // get surveys environment
      const surveysEnvironmentId = await getEnvironmentIdFromSurveyIds(body.surveyIds);

      if (!surveysEnvironmentId.ok) {
        return handleApiError(request, surveysEnvironmentId.error);
      }

      // get webhook environment
      const webhook = await getWebhook(params.webhookId);

      if (!webhook.ok) {
        return handleApiError(request, webhook.error);
      }

      // check webhook environment against the api key environment
      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId: webhook.ok ? webhook.data.environmentId : "",
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      // check if webhook environment matches the surveys environment
      if (webhook.data.environmentId !== surveysEnvironmentId.data) {
        return handleApiError(request, {
          type: "bad_request",
          details: [
            { field: "surveys id", issue: "webhook environment does not match the surveys environment" },
          ],
        });
      }

      const updatedWebhook = await updateWebhook(params.webhookId, body);

      if (!updatedWebhook.ok) {
        return handleApiError(request, updatedWebhook.error);
      }

      return responses.successResponse(updatedWebhook);
    },
  });

export const DELETE = async (request: NextRequest, props: { params: Promise<{ webhookId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ webhookId: webhookIdSchema }),
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

      const checkAuthorizationResult = await checkAuthorization({
        authentication,
        environmentId: webhook.ok ? webhook.data.environmentId : "",
      });

      if (!checkAuthorizationResult.ok) {
        return handleApiError(request, checkAuthorizationResult.error);
      }

      const deletedWebhook = await deleteWebhook(params.webhookId);

      if (!deletedWebhook.ok) {
        return handleApiError(request, deletedWebhook.error);
      }

      return responses.successResponse(deletedWebhook);
    },
  });
