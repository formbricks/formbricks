import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasOrganizationIdAndAccess } from "@/modules/api/v2/organizations/[organizationId]/lib/utils";
import {
  deleteTeam,
  getTeam,
  updateTeam,
} from "@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/lib/teams";
import {
  ZTeamIdSchema,
  ZTeamUpdateSchema,
} from "@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/types/teams";
import { ZOrganizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";

export const GET = async (
  request: Request,
  props: { params: Promise<{ teamId: string; organizationId: string }> }
) =>
  authenticatedApiClient({
    request,
    schemas: {
      params: z.object({ teamId: ZTeamIdSchema, organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { params } }) => {
      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Read)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const team = await getTeam(params!.organizationId, params!.teamId);
      if (!team.ok) {
        return handleApiError(request, team.error as ApiErrorResponseV2);
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
      params: z.object({ teamId: ZTeamIdSchema, organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ authentication, parsedInput: { params }, auditLog }) => {
      if (auditLog) {
        auditLog.targetId = params.teamId;
      }

      if (!hasOrganizationIdAndAccess(params.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "organizationId", issue: "unauthorized" }],
          },
          auditLog
        );
      }

      let oldTeamData: any = UNKNOWN_DATA;
      try {
        const oldTeamResult = await getTeam(params.organizationId, params.teamId);
        if (oldTeamResult.ok) {
          oldTeamData = oldTeamResult.data;
        }
      } catch (error) {
        logger.error(`Failed to fetch old team data for audit log: ${JSON.stringify(error)}`);
      }

      const team = await deleteTeam(params.organizationId, params.teamId);

      if (!team.ok) {
        return handleApiError(request, team.error, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = oldTeamData;
      }

      return responses.successResponse(team);
    },
    action: "deleted",
    targetType: "team",
  });

export const PUT = (
  request: Request,
  props: { params: Promise<{ teamId: string; organizationId: string }> }
) =>
  authenticatedApiClient({
    request,
    externalParams: props.params,
    schemas: {
      params: z.object({ teamId: ZTeamIdSchema, organizationId: ZOrganizationIdSchema }),
      body: ZTeamUpdateSchema,
    },
    handler: async ({ authentication, parsedInput: { body, params }, auditLog }) => {
      if (auditLog) {
        auditLog.targetId = params.teamId;
      }

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "organizationId", issue: "unauthorized" }],
          },
          auditLog
        );
      }

      let oldTeamData: any = UNKNOWN_DATA;
      try {
        const oldTeamResult = await getTeam(params.organizationId, params.teamId);
        if (oldTeamResult.ok) {
          oldTeamData = oldTeamResult.data;
        }
      } catch (error) {
        logger.error(`Failed to fetch old team data for audit log: ${JSON.stringify(error)}`);
      }

      const team = await updateTeam(params!.organizationId, params!.teamId, body!);

      if (!team.ok) {
        return handleApiError(request, team.error, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = oldTeamData;
        auditLog.newObject = team.data;
      }

      return responses.successResponse(team);
    },
    action: "updated",
    targetType: "team",
  });
