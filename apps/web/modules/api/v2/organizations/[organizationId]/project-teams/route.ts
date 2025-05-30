import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasOrganizationIdAndAccess } from "@/modules/api/v2/organizations/[organizationId]/lib/utils";
import { checkAuthenticationAndAccess } from "@/modules/api/v2/organizations/[organizationId]/project-teams/lib/utils";
import { ZOrganizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
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
    handler: async ({ parsedInput: { body, params }, authentication }) => {
      const { teamId, projectId } = body!;

      const auditLogBase = {
        actionType: "projectTeam.created" as const,
        targetType: "projectTeam" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: `${projectId}-${teamId}`,
        organizationId: authentication.organizationId,
        status: "failure" as const,
        apiUrl: request.url,
      };

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "organizationId", issue: "unauthorized" }],
          },
          auditLogBase
        );
      }

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error, auditLogBase);
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
        return handleApiError(request, existingProjectTeam.error, auditLogBase);
      }

      if (existingProjectTeam.data.data.length > 0) {
        return handleApiError(
          request,
          {
            type: "conflict",
            details: [{ field: "projectTeam", issue: "Project team already exists" }],
          },
          auditLogBase
        );
      }
      const result = await createProjectTeam(body!);
      if (!result.ok) {
        return handleApiError(request, result.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        status: "success",
        newObject: result.data,
      });

      return responses.successResponse({ data: result.data });
    },
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
    handler: async ({ parsedInput: { body, params }, authentication }) => {
      const { teamId, projectId } = body!;

      const auditLogBase = {
        actionType: "projectTeam.updated" as const,
        targetType: "projectTeam" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: `${projectId}-${teamId}`, // Composite ID for projectTeam
        organizationId: authentication.organizationId,
        status: "failure" as const,
        apiUrl: request.url,
      };

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "organizationId", issue: "unauthorized" }],
          },
          auditLogBase
        );
      }

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error, auditLogBase);
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
        logger.error(`Failed to fetch old project team data for audit log: ${JSON.stringify(error)}`);
      }

      const result = await updateProjectTeam(teamId, projectId, body!);
      if (!result.ok) {
        return handleApiError(request, result.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        status: "success",
        oldObject: oldProjectTeamData,
        newObject: result.data,
      });

      return responses.successResponse({ data: result.data });
    },
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
    handler: async ({ parsedInput: { query, params }, authentication }) => {
      const { teamId, projectId } = query!;

      const auditLogBase = {
        actionType: "projectTeam.deleted" as const,
        targetType: "projectTeam" as const,
        userId: authentication.apiKeyId,
        userType: "api" as const,
        targetId: `${projectId}-${teamId}`, // Composite ID for projectTeam
        organizationId: authentication.organizationId,
        status: "failure" as const,
        apiUrl: request.url,
      };

      if (!hasOrganizationIdAndAccess(params!.organizationId, authentication, OrganizationAccessType.Write)) {
        return handleApiError(
          request,
          {
            type: "unauthorized",
            details: [{ field: "organizationId", issue: "unauthorized" }],
          },
          auditLogBase
        );
      }

      const hasAccess = await checkAuthenticationAndAccess(teamId, projectId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error, auditLogBase);
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
        logger.error(`Failed to fetch old project team data for audit log: ${JSON.stringify(error)}`);
      }

      const result = await deleteProjectTeam(teamId, projectId);
      if (!result.ok) {
        return handleApiError(request, result.error, auditLogBase);
      }

      queueAuditEvent({
        ...auditLogBase,
        status: "success",
        oldObject: oldProjectTeamData,
      });

      return responses.successResponse({ data: result.data });
    },
  });
}
