import {
  deleteResponseEndpoint,
  getResponseEndpoint,
  updateResponseEndpoint,
} from "@/modules/api/management/responses/[responseId]/openapi";
import {
  createResponseEndpoint,
  getResponsesEndpoint,
} from "@/modules/api/management/responses/openapi/index";
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
