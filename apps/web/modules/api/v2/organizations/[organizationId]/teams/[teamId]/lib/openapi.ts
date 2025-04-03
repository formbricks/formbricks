import { teamIdSchema } from "@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/types/teams";
import { ZTeamInput } from "@/modules/api/v2/organizations/[organizationId]/teams/types/teams";
import { makePartialSchema } from "@/modules/api/v2/types/openapi-response";
import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZTeam } from "@formbricks/database/zod/teams";

export const getTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "getTeam",
  summary: "Get a team",
  description: "Gets a team from the database.",
  requestParams: {
    path: z.object({
      id: teamIdSchema,
    }),
  },
  tags: ["Organizations API > Teams"],
  responses: {
    "200": {
      description: "Team retrieved successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZTeam),
        },
      },
    },
  },
};

export const deleteTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "deleteTeam",
  summary: "Delete a team",
  description: "Deletes a team from the database.",
  tags: ["Organizations API > Teams"],
  requestParams: {
    path: z.object({
      id: teamIdSchema,
    }),
  },
  responses: {
    "200": {
      description: "Team deleted successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZTeam),
        },
      },
    },
  },
};

export const updateTeamEndpoint: ZodOpenApiOperationObject = {
  operationId: "updateTeam",
  summary: "Update a team",
  description: "Updates a team in the database.",
  tags: ["Organizations API > Teams"],
  requestParams: {
    path: z.object({
      id: teamIdSchema,
    }),
  },
  requestBody: {
    required: true,
    description: "The team to update",
    content: {
      "application/json": {
        schema: ZTeamInput,
      },
    },
  },
  responses: {
    "200": {
      description: "Team updated successfully.",
      content: {
        "application/json": {
          schema: makePartialSchema(ZTeam),
        },
      },
    },
  },
};
