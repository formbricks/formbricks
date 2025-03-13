import {
  deleteResponseEndpoint,
  getResponseEndpoint,
  updateResponseEndpoint,
} from "@/modules/api/v2/management/responses/[responseId]/lib/openapi";
import { ZGetResponsesFilter, ZResponseInput } from "@/modules/api/v2/management/responses/types/responses";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZResponse } from "@formbricks/database/zod/responses";

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
          schema: z.array(responseWithMetaSchema(makePartialSchema(ZResponse))),
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
    get: getResponsesEndpoint,
    post: createResponseEndpoint,
  },
  "/responses/{id}": {
    get: getResponseEndpoint,
    put: updateResponseEndpoint,
    delete: deleteResponseEndpoint,
  },
};
