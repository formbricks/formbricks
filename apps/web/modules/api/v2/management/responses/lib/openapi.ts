import { createResponseEndpoint, getResponsesEndpoint } from "@/modules/api/v2/lib/openapi";
import {
  deleteResponseEndpoint,
  getResponseEndpoint,
  updateResponseEndpoint,
} from "@/modules/api/v2/management/responses/[responseId]/lib/openapi";
import { ZodOpenApiPathsObject } from "zod-openapi";

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
