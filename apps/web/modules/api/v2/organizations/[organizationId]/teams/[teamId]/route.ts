import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import {
  deleteTeam,
  getTeam,
  updateTeam,
} from "@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/lib/teams";
import {
  teamIdSchema,
  teamUpdateSchema,
} from "@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/types/teams";
import { organizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import { z } from "zod";
import { logger } from "@formbricks/logger";

export const GET = async (
  request: Request,
  props: { params: Promise<{ teamId: string; organizationId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ teamId: teamIdSchema, organizationId: organizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { params } }) => {
      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");

        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      if (params!.organizationId !== authentication.organizationId) {
        logger.error("Organization ID from params does not match the authenticated organization ID");

        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      if (!authentication.organizationAccess?.accessControl?.read) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const team = await getTeam(params!.teamId);
      if (!team.ok) {
        return handleApiError(request, team.error);
      }

      return responses.successResponse(team);
    },
  });

export const DELETE = async (
  request: Request,
  props: { params: Promise<{ teamId: string; organizationId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ teamId: teamIdSchema, organizationId: organizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { params } }) => {
      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");

        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      if (params!.organizationId !== authentication.organizationId) {
        logger.error("Organization ID from params does not match the authenticated organization ID");

        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      if (!authentication.organizationAccess?.accessControl?.write) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const team = await deleteTeam(params!.teamId);

      if (!team.ok) {
        return handleApiError(request, team.error);
      }

      return responses.successResponse(team);
    },
  });

export const PUT = (
  request: Request,
  props: { params: Promise<{ teamId: string; organizationId: string }> }
) =>
  authenticatedApiClient({
    request,
    externalParams: props.params,
    schemas: {
      params: z.object({ teamId: teamIdSchema, organizationId: organizationIdSchema }),
      body: teamUpdateSchema,
    },
    handler: async ({ authentication, parsedInput: { body, params } }) => {
      if (!authentication.organizationId) {
        logger.error("Organization ID is missing from the authentication object");

        return handleApiError(request, {
          type: "unauthorized",
        });
      }

      if (params!.organizationId !== authentication.organizationId) {
        logger.error("Organization ID from params does not match the authenticated organization ID");

        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      if (!authentication.organizationAccess?.accessControl?.write) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const team = await updateTeam(params!.teamId, body!);

      if (!team.ok) {
        return handleApiError(request, team.error);
      }

      return responses.successResponse(team);
    },
  });
