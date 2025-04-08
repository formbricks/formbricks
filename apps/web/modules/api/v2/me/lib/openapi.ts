import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZApiKeyData } from "@formbricks/database/zod/api-keys";

export const getMeEndpoint: ZodOpenApiOperationObject = {
  operationId: "me",
  summary: "Me",
  description: "Fetches the projects and organizations associated with the API key.",
  tags: ["Me"],
  responses: {
    "200": {
      description: "API key information retrieved successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZApiKeyData),
        },
      },
    },
  },
};

export const mePaths: ZodOpenApiPathsObject = {
  "/me": {
    get: getMeEndpoint,
  },
};
