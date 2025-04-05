import { ZWebhookIdSchema } from "@/modules/api/v2/management/webhooks/[webhookId]/types/webhooks";
import { ZWebhookInput } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZWebhook } from "@formbricks/database/zod/webhooks";

export const getWebhookEndpoint: ZodOpenApiOperationObject = {
  operationId: "getWebhook",
  summary: "Get a webhook",
  description: "Gets a webhook from the database.",
  requestParams: {
    path: z.object({
      id: ZWebhookIdSchema,
    }),
  },
  tags: ["Management API > Webhooks"],
  responses: {
    "200": {
      description: "Webhook retrieved successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZWebhook),
        },
      },
    },
  },
};

export const deleteWebhookEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteWebhook",
  summary: "Delete a webhook",
  description: "Deletes a webhook from the database.",
  tags: ["Management API > Webhooks"],
  requestParams: {
    path: z.object({
      id: ZWebhookIdSchema,
    }),
  },
  responses: {
    "200": {
      description: "Webhook deleted successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZWebhook),
        },
      },
    },
  },
};

export const updateWebhookEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateWebhook",
  summary: "Update a webhook",
  description: "Updates a webhook in the database.",
  tags: ["Management API > Webhooks"],
  requestParams: {
    path: z.object({
      id: ZWebhookIdSchema,
    }),
  },
  requestBody: {
    required: true,
    description: "The webhook to update",
    content: {
      "application/json": {
        schema: ZWebhookInput,
      },
    },
  },
  responses: {
    "200": {
      description: "Webhook updated successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZWebhook),
        },
      },
    },
  },
};
