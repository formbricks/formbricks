import { responseIdSchema } from "@/modules/api/v2/management/responses/[responseId]/types/responses";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZResponse } from "@formbricks/database/zod/responses";
import { ZResponseInput } from "@formbricks/types/responses";

export const getResponseEndpoint: ZodOpenApiOperationObject = {
  operationId: "getResponse",
  summary: "Get a response",
  description: "Gets a response from the database.",
  requestParams: {
    path: z.object({
      id: responseIdSchema,
    }),
  },
  tags: ["Management API > Responses"],
  responses: {
    "200": {
      description: "Response retrieved successfully.",
      content: {
        "application/json": {
          schema: ZResponse,
        },
      },
    },
  },
};

export const deleteResponseEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteResponse",
  summary: "Delete a response",
  description: "Deletes a response from the database.",
  tags: ["Management API > Responses"],
  requestParams: {
    path: z.object({
      id: responseIdSchema,
    }),
  },
  responses: {
    "200": {
      description: "Response deleted successfully.",
      content: {
        "application/json": {
          schema: ZResponse,
        },
      },
    },
  },
};

export const updateResponseEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateResponse",
  summary: "Update a response",
  description: "Updates a response in the database.",
  tags: ["Management API > Responses"],
  requestParams: {
    path: z.object({
      id: responseIdSchema,
    }),
  },
  requestBody: {
    required: true,
    description: "The response to update",
    content: {
      "application/json": {
        schema: ZResponseInput,
      },
    },
  },
  responses: {
    "200": {
      description: "Response updated successfully.",
      content: {
        "application/json": {
          schema: ZResponse,
        },
      },
    },
  },
};
