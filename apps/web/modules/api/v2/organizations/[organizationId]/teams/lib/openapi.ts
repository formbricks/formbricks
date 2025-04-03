import {
  deleteTeamEndpoint,
  getTeamEndpoint,
  updateTeamEndpoint,
} from "@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/lib/openapi";
import {
  ZGetTeamsFilter,
  ZTeamInput,
} from "@/modules/api/v2/organizations/[organizationId]/teams/types/teams";
import { organizationServer } from "@/modules/api/v2/organizations/lib/openapi";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";
import { z } from "zod";
import { ZodOpenApiOperationObject, ZodOpenApiPathsObject } from "zod-openapi";
import { ZTeam } from "@formbricks/database/zod/teams";

export const getTeamsEndpoint: ZodOpenApiOperationObject = {
  operationId: "getTeams",
  summary: "Get teams",
  description: "Gets teams from the database.",
  requestParams: {
    query: ZGetTeamsFilter.sourceType().required(),
  },
  tags: ["Organizations API > Teams"],
  responses: {
    "200": {
      description: "Teams retrieved successfully.",
      content: {
        "application/json": {
          schema: z.array(responseWithMetaSchema(makePartialSchema(ZTeam))),
        },
      },
    },
  },
};

export const createTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "createTeam",
  summary: "Create a team",
  description: "Creates a team in the database.",
  tags: ["Organizations API > Teams"],
  requestBody: {
    required: true,
    description: "The team to create",
    content: {
      "application/json": {
        schema: ZTeamInput,
      },
    },
  },
  responses: {
    "201": {
      description: "Team created successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZTeam),
        },
      },
    },
  },
};

export const teamPaths: ZodOpenApiPathsObject = {
  "/teams": {
    servers: organizationServer,
    get: getTeamsEndpoint,
    post: createTeamEndpoint,
  },
  "/teams/{id}": {
    servers: organizationServer,
    get: getTeamEndpoint,
    put: updateTeamEndpoint,
    delete: deleteTeamEndpoint,
  },
};
