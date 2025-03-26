import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { deleteTeam, getTeam, updateTeam } from "@/modules/api/v2/organizations/teams/[teamId]/lib/teams";
import { teamIdSchema, teamUpdateSchema } from "@/modules/api/v2/organizations/teams/[teamId]/types/teams";
import { z } from "zod";
import { logger } from "@formbricks/logger";

export const GET = async (request: Request, props: { params: Promise<{ teamId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ teamId: teamIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;

      if (!params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "params", issue: "missing" }],
        });
      }

      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");

        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const team = await getTeam(params.teamId);
      if (!team.ok) {
        return handleApiError(request, team.error);
      }

      return responses.successResponse(team);
    },
  });

export const DELETE = async (request: Request, props: { params: Promise<{ teamId: string }> }) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ teamId: teamIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput }) => {
      const { params } = parsedInput;

      if (!params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "params", issue: "missing" }],
        });
      }

      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");

        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const team = await deleteTeam(params.teamId);

      if (!team.ok) {
        return handleApiError(request, team.error);
      }

      return responses.successResponse(team);
    },
  });

export const PUT = (request: Request, props: { params: Promise<{ teamId: string }> }) =>
  authenticatedApiClient({
    request,
    externalParams: props.params,
    schemas: {
      params: z.object({ teamId: teamIdSchema }),
      body: teamUpdateSchema,
    },
    handler: async ({ authentication, parsedInput }) => {
      const { body, params } = parsedInput;

      if (!body || !params) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: !body ? "body" : "params", issue: "missing" }],
        });
      }

      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");

        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      const team = await updateTeam(params.teamId, body);

      if (!team.ok) {
        return handleApiError(request, team.error);
      }

      return responses.successResponse(team);
    },
  });
