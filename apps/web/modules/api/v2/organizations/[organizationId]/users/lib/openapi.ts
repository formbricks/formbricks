import { ZOrganizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import {
  ZGetUsersFilter,
  ZUserInput,
  ZUserInputPatch,
} from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { organizationServer } from "@/modules/api/v2/organizations/lib/openapi";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZUser } from "@formbricks/database/zod/users";

export const getUsersEndpoint: ZodOpenApiOperationObject = {
  operationId: "getUsers",
  summary: "Get users",
  description: `Gets users from the database.<br />Only available for self-hosted Formbricks.`,
  requestParams: {
    path: z.object({
      organizationId: ZOrganizationIdSchema,
    }),
    query: ZGetUsersFilter.sourceType(),
  },
  tags: ["Organizations API > Users"],
  responses: {
    "200": {
      description: "Users retrieved successfully.",
      content: {
        "application/json": {
          schema: responseWithMetaSchema(makePartialSchema(ZUser)),
        },
      },
    },
  },
};

export const createUserEndpoint: ZodOpenApiOperationObject = {
  operationId: "createUser",
  summary: "Create a user",
  description: `Gets users from the database.<br />Only available for self-hosted Formbricks.`,
  requestParams: {
    path: z.object({
      organizationId: ZOrganizationIdSchema,
    }),
  },
  tags: ["Organizations API > Users"],
  requestBody: {
    required: true,
    description: "The user to create",
    content: {
      "application/json": {
        schema: ZUserInput,
      },
    },
  },
  responses: {
    "201": {
      description: "User created successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZUser),
        },
      },
    },
  },
};

export const updateUserEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateUser",
  summary: "Update a user",
  description: `Gets users from the database.<br />Only available for self-hosted Formbricks.`,
  requestParams: {
    path: z.object({
      organizationId: ZOrganizationIdSchema,
    }),
  },
  tags: ["Organizations API > Users"],
  requestBody: {
    required: true,
    description: "The user to update",
    content: {
      "application/json": {
        schema: ZUserInputPatch,
      },
    },
  },
  responses: {
    "201": {
      description: "User updated successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZUser),
        },
      },
    },
  },
};

export const userPaths: ZodOpenApiPathsObject = {
  "/{organizationId}/users": {
    servers: organizationServer,
    get: getUsersEndpoint,
    post: createUserEndpoint,
    patch: updateUserEndpoint,
  },
};
