import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasOrganizationIdAndAccess } from "@/modules/api/v2/organizations/[organizationId]/lib/utils";
import { checkAuthenticationAndAccess } from "@/modules/api/v2/organizations/[organizationId]/project-teams/lib/utils";
import { ZOrganizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import {
  createProjectTeam,
  deleteProjectTeam,
  getProjectTeams,
  updateProjectTeam,
} from "./lib/project-teams";
import {
  ZGetProjectTeamUpdateFilter,
  ZGetProjectTeamsFilter,
  ZProjectTeamInput,
} from "./types/project-teams";

export async function GET(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    schemas: {
      query: ZGetProjectTeamsFilter.sourceType(),
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { query, params }, authentication }) => {
      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Read)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const result = await getProjectTeams(authentication.organizationId, query!);

      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse(result.data);
    },
  });
}

export async function POST(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    schemas: {
      body: ZProjectTeamInput,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { body, params }, authentication, auditLog }) => {
      const { teamId, projectId } = body!;

      if (auditLog) {
        auditLog.targetId = `${projectId}-${teamId}`;
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

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error, auditLog);
      }

      // check if project team already exists
      const existingProjectTeam = await getProjectTeams(authentication.organizationId, {
        teamId,
        projectId,
        limit: 10,
        skip: 0,
        sortBy: "createdAt",
        order: "desc",
      });

      if (!existingProjectTeam.ok) {
        return handleApiError(request, existingProjectTeam.error, auditLog);
      }

      if (existingProjectTeam.data.data.length > 0) {
        return handleApiError(
          request,
          {
            type: "conflict",
            details: [{ field: "projectTeam", issue: "Project team already exists" }],
          },
          auditLog
        );
      }
      const result = await createProjectTeam(body!);
      if (!result.ok) {
        return handleApiError(request, result.error, auditLog);
      }

      if (auditLog) {
        auditLog.newObject = result.data;
      }

      return responses.successResponse({ data: result.data });
    },
    action: "created",
    targetType: "projectTeam",
  });
}

export async function PUT(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    schemas: {
      body: ZProjectTeamInput,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { body, params }, authentication, auditLog }) => {
      const { teamId, projectId } = body!;

      if (auditLog) {
        auditLog.targetId = `${projectId}-${teamId}`;
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

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error, auditLog);
      }

      // Fetch old object for audit log
      let oldProjectTeamData: any = UNKNOWN_DATA;
      try {
        const oldProjectTeamResult = await getProjectTeams(authentication.organizationId, {
          teamId,
          projectId,
          limit: 1,
          skip: 0,
          sortBy: "createdAt",
          order: "desc",
        });

        if (oldProjectTeamResult.ok && oldProjectTeamResult.data.data.length > 0) {
          oldProjectTeamData = oldProjectTeamResult.data.data[0];
        } else {
          logger.error(`Failed to fetch old project team data for audit log`);
        }
      } catch (error) {
        logger.error(error, `Failed to fetch old project team data for audit log`);
      }

      const result = await updateProjectTeam(teamId, projectId, body!);
      if (!result.ok) {
        return handleApiError(request, result.error, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = oldProjectTeamData;
        auditLog.newObject = result.data;
      }

      return responses.successResponse({ data: result.data });
    },
    action: "updated",
    targetType: "projectTeam",
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    schemas: {
      query: ZGetProjectTeamUpdateFilter,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { query, params }, authentication, auditLog }) => {
      const { teamId, projectId } = query!;

      if (auditLog) {
        auditLog.targetId = `${projectId}-${teamId}`;
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

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error, auditLog);
      }

      // Fetch old object for audit log
      let oldProjectTeamData: any = UNKNOWN_DATA;
      try {
        const oldProjectTeamResult = await getProjectTeams(authentication.organizationId, {
          teamId,
          projectId,
          limit: 1,
          skip: 0,
          sortBy: "createdAt",
          order: "desc",
        });

        if (oldProjectTeamResult.ok && oldProjectTeamResult.data.data.length > 0) {
          oldProjectTeamData = oldProjectTeamResult.data.data[0];
        } else {
          logger.error(`Failed to fetch old project team data for audit log`);
        }
      } catch (error) {
        logger.error(error, `Failed to fetch old project team data for audit log`);
      }

      const result = await deleteProjectTeam(teamId, projectId);
      if (!result.ok) {
        return handleApiError(request, result.error, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = oldProjectTeamData;
      }

      return responses.successResponse({ data: result.data });
    },
    action: "deleted",
    targetType: "projectTeam",
  });
}
