import {
  deleteWebhookEndpoint,
  getWebhookEndpoint,
  updateWebhookEndpoint,
} from "@/modules/api/v2/management/webhooks/[webhookId]/lib/openapi";
import { ZGetWebhooksFilter, ZWebhookInput } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZWebhook } from "@formbricks/database/zod/webhooks";

export const getWebhooksEndpoint: ZodOpenApiOperationObject = {
  operationId: "getWebhooks",
  summary: "Get webhooks",
  description: "Gets webhooks from the database.",
  requestParams: {
    query: ZGetWebhooksFilter.sourceType(),
  },
  tags: ["Management API > Webhooks"],
  responses: {
    "200": {
      description: "Webhooks retrieved successfully.",
      content: {
        "application/json": {
          schema: responseWithMetaSchema(makePartialSchema(ZWebhook)),
        },
      },
    },
  },
};

export const createWebhookEndpoint: ZodOpenApiOperationObject = {
  operationId: "createWebhook",
  summary: "Create a webhook",
  description: "Creates a webhook in the database.",
  tags: ["Management API > Webhooks"],
  requestBody: {
    required: true,
    description: "The webhook to create",
    content: {
      "application/json": {
        schema: ZWebhookInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Webhook created successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZWebhook),
        },
      },
    },
  },
};

export const webhookPaths: ZodOpenApiPathsObject = {
  "/webhooks": {
    get: getWebhooksEndpoint,
    post: createWebhookEndpoint,
  },
  "/webhooks/{id}": {
    get: getWebhookEndpoint,
    put: updateWebhookEndpoint,
    delete: deleteWebhookEndpoint,
  },
};
