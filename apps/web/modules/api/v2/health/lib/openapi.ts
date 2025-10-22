import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZOverallHealthStatus } from "@/modules/api/v2/health/types/health-status";
import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";

export const healthCheckEndpoint: ZodOpenApiOperationObject = {
  tags: ["Health"],
  summary: "Health Check",
  description: "Check the health status of critical application dependencies including database and cache.",
  requestParams: {},
  operationId: "healthCheck",
  security: [],
  responses: {
    "200": {
      description:
        "Health check completed successfully. Check individual dependency status in response data.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZOverallHealthStatus),
        },
      },
    },
  },
};

export const healthPaths = {
  "/health": {
    get: healthCheckEndpoint,
  },
};
