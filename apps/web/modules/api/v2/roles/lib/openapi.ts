import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZRoles } from "@formbricks/database/zod/roles";

export const getRolesEndpoint: ZodOpenApiOperationObject = {
  operationId: "getRoles",
  summary: "Get roles",
  description: "Gets roles from the database.",
  requestParams: {},
  tags: ["Roles"],
  responses: {
    "200": {
      description: "Roles retrieved successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZRoles),
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
