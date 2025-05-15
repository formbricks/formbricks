import { managementServer } from "@/modules/api/v2/management/lib/openapi";
import {
  deleteResponseEndpoint,
  getResponseEndpoint,
  updateResponseEndpoint,
} from "@/modules/api/v2/management/responses/[responseId]/lib/openapi";
import { ZGetResponsesFilter, ZResponseInput } from "@/modules/api/v2/management/responses/types/responses";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZResponse } from "@formbricks/database/zod/responses";

export const getResponsesEndpoint: ZodOpenApiOperationObject = {
  operationId: "getResponses",
  summary: "Get responses",
  description: "Gets responses from the database.",
  requestParams: {
    query: ZGetResponsesFilter.sourceType(),
  },
  tags: ["Management API > Responses"],
  responses: {
    "200": {
      description: "Responses retrieved successfully.",
      content: {
        "application/json": {
          schema: responseWithMetaSchema(makePartialSchema(ZResponse)),
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
          schema: makePartialSchema(ZResponse),
        },
      },
    },
  },
};

export const responsePaths: ZodOpenApiPathsObject = {
  "/responses": {
    servers: managementServer,
    get: getResponsesEndpoint,
    post: createResponseEndpoint,
  },
  "/responses/{id}": {
    servers: managementServer,
    get: getResponseEndpoint,
    put: updateResponseEndpoint,
    delete: deleteResponseEndpoint,
  },
};
