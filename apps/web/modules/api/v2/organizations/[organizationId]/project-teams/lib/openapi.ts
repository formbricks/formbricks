import {
  ZGetProjectTeamUpdateFilter,
  ZGetProjectTeamsFilter,
  ZProjectTeamInput,
  projectTeamUpdateSchema,
} from "@/modules/api/v2/organizations/[organizationId]/project-teams/types/project-teams";
import { organizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import { organizationServer } from "@/modules/api/v2/organizations/lib/openapi";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZProjectTeam } from "@formbricks/database/zod/project-teams";

export const getProjectTeamsEndpoint: ZodOpenApiOperationObject = {
  operationId: "getProjectTeams",
  summary: "Get project teams",
  description: "Gets projectTeams from the database.",
  requestParams: {
    query: ZGetProjectTeamsFilter.sourceType().required(),
    path: z.object({
      organizationId: organizationIdSchema,
    }),
  },
  tags: ["Organizations API > Project Teams"],
  responses: {
    "200": {
      description: "Project teams retrieved successfully.",
      content: {
        "application/json": {
          schema: responseWithMetaSchema(makePartialSchema(ZProjectTeam)),
        },
      },
    },
  },
};

export const createProjectTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "createProjectTeam",
  summary: "Create a projectTeam",
  description: "Creates a project team in the database.",
  requestParams: {
    path: z.object({
      organizationId: organizationIdSchema,
    }),
  },
  tags: ["Organizations API > Project Teams"],
  requestBody: {
    required: true,
    description: "The project team to create",
    content: {
      "application/json": {
        schema: ZProjectTeamInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Project team created successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZProjectTeam),
        },
      },
    },
  },
};

export const deleteProjectTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteProjectTeam",
  summary: "Delete a project team",
  description: "Deletes a project team from the database.",
  tags: ["Organizations API > Project Teams"],
  requestParams: {
    query: ZGetProjectTeamUpdateFilter.required(),
    path: z.object({
      organizationId: organizationIdSchema,
    }),
  },
  responses: {
    "200": {
      description: "Project team deleted successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZProjectTeam),
        },
      },
    },
  },
};

export const updateProjectTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateProjectTeam",
  summary: "Update a project team",
  description: "Updates a project team in the database.",
  tags: ["Organizations API > Project Teams"],
  requestParams: {
    query: ZGetProjectTeamUpdateFilter.required(),
    path: z.object({
      organizationId: organizationIdSchema,
    }),
  },
  requestBody: {
    required: true,
    description: "The project team to update",
    content: {
      "application/json": {
        schema: projectTeamUpdateSchema,
      },
    },
  },
  responses: {
    "200": {
      description: "Project team updated successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZProjectTeam),
        },
      },
    },
  },
};

export const projectTeamPaths: ZodOpenApiPathsObject = {
  "/{organizationId}/project-teams": {
    servers: organizationServer,
    get: getProjectTeamsEndpoint,
    post: createProjectTeamEndpoint,
    put: updateProjectTeamEndpoint,
    delete: deleteProjectTeamEndpoint,
  },
};
