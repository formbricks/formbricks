import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";

export const getRolesEndpoint: ZodOpenApiOperationObject = {
  operationId: "getRoles",
  summary: "Get roles",
  description: "Gets roles from the database.",
  requestParams: {},
  tags: ["Management API > Roles"],
  responses: {
    "200": {
      description: "Roles retrieved successfully.",
      content: {
        "application/json": {
          schema: z.array(z.string()),
        },
      },
    },
  },
};

export const rolePaths: ZodOpenApiPathsObject = {
  "/roles": {
    get: getRolesEndpoint,
  },
};
