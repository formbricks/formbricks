import { ZGetResponsesFilter } from "@/modules/api/management/responses/types/responses";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZResponse } from "@formbricks/database/zod/responses";
import { ZResponseInput } from "@formbricks/types/responses";

export const getResponsesEndpoint: ZodOpenApiOperationObject = {
  operationId: "getResponses",
  summary: "Get responses",
  description: "Gets responses from the database.",
  requestParams: {
    query: ZGetResponsesFilter.sourceType().required(),
  },
  tags: ["responses"],
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
  tags: ["responses"],
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
