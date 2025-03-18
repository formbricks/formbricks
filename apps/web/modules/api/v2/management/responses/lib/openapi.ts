import {
  deleteResponseEndpoint,
  getResponseEndpoint,
  updateResponseEndpoint,
} from "@/modules/api/v2/management/responses/[responseId]/lib/openapi";
import { ZGetResponsesFilter } from "@/modules/api/v2/management/responses/types/responses";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZResponse, ZResponseInput } from "@formbricks/types/responses";

export const getResponsesEndpoint: ZodOpenApiOperationObject = {
  operationId: "getResponses",
  summary: "Get responses",
  description: "Gets responses from the database.",
  requestParams: {
    query: ZGetResponsesFilter.sourceType().required(),
  },
  tags: ["Management API > Responses"],
  responses: {
    "200": {
      description: "Responses retrieved successfully.",
      content: {
        "application/json": {
          schema: z.array(ZResponse),
        },
      },
    },
  },
};

export const createResponseEndpoint: ZodOpenApiOperationObject = {
  operationId: "createResponse",
  summary: "Create a response",
  description: "Creates a response in the database.",
  tags: ["Management API > Responses"],
  requestBody: {
    required: true,
    description: "The response to create",
    content: {
      "application/json": {
        schema: ZResponseInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Response created successfully.",
      content: {
        "application/json": {
          schema: ZResponse,
        },
      },
    },
  },
};

export const responsePaths: ZodOpenApiPathsObject = {
  "/responses": {
    get: getResponsesEndpoint,
    post: createResponseEndpoint,
  },
  "/responses/{id}": {
    get: getResponseEndpoint,
    put: updateResponseEndpoint,
    delete: deleteResponseEndpoint,
  },
};
