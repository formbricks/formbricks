import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZWorkspaceTeam } from "@formbricks/database/zod/workspace-teams";
import { ZOrganizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import {
  ZGetWorkspaceTeamUpdateFilter,
  ZGetWorkspaceTeamsFilter,
  ZWorkspaceTeamInput,
} from "@/modules/api/v2/organizations/[organizationId]/workspace-teams/types/workspace-teams";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";

export const getWorkspaceTeamsEndpoint: ZodOpenApiOperationObject = {
  operationId: "getWorkspaceTeams",
  summary: "Get workspace teams",
  description: "Gets workspaceTeams from the database.",
  requestParams: {
    query: ZGetWorkspaceTeamsFilter,
    path: z.object({
      organizationId: ZOrganizationIdSchema,
    }),
  },
  tags: ["Organizations API - Workspace Teams"],
  responses: {
    "200": {
      description: "Workspace teams retrieved successfully.",
      content: {
        "application/json": {
          schema: responseWithMetaSchema(makePartialSchema(ZWorkspaceTeam)),
        },
      },
    },
  },
};

export const createWorkspaceTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "createWorkspaceTeam",
  summary: "Create a workspaceTeam",
  description: "Creates a workspace team in the database.",
  requestParams: {
    path: z.object({
      organizationId: ZOrganizationIdSchema,
    }),
  },
  tags: ["Organizations API - Workspace Teams"],
  requestBody: {
    required: true,
    description: "The workspace team to create",
    content: {
      "application/json": {
        schema: ZWorkspaceTeamInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Workspace team created successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZWorkspaceTeam),
        },
      },
    },
  },
};

export const deleteWorkspaceTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteWorkspaceTeam",
  summary: "Delete a workspace team",
  description: "Deletes a workspace team from the database.",
  tags: ["Organizations API - Workspace Teams"],
  requestParams: {
    query: ZGetWorkspaceTeamUpdateFilter.required(),
    path: z.object({
      organizationId: ZOrganizationIdSchema,
    }),
  },
  responses: {
    "200": {
      description: "Workspace team deleted successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZWorkspaceTeam),
        },
      },
    },
  },
};

export const updateWorkspaceTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateWorkspaceTeam",
  summary: "Update a workspace team",
  description: "Updates a workspace team in the database.",
  tags: ["Organizations API - Workspace Teams"],
  requestParams: {
    path: z.object({
      organizationId: ZOrganizationIdSchema,
    }),
  },
  requestBody: {
    required: true,
    description: "The workspace team to update",
    content: {
      "application/json": {
        schema: ZWorkspaceTeamInput,
      },
    },
  },
  responses: {
    "200": {
      description: "Workspace team updated successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZWorkspaceTeam),
        },
      },
    },
  },
};

export const workspaceTeamPaths: ZodOpenApiPathsObject = {
  "/organizations/{organizationId}/workspace-teams": {
    get: getWorkspaceTeamsEndpoint,
    post: createWorkspaceTeamEndpoint,
    put: updateWorkspaceTeamEndpoint,
    delete: deleteWorkspaceTeamEndpoint,
  },
};
