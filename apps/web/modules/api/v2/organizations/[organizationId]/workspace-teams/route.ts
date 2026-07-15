import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasOrganizationIdAndAccess } from "@/modules/api/v2/organizations/[organizationId]/lib/utils";
import { ZOrganizationIdSchema } from "@/modules/api/v2/organizations/[organizationId]/types/organizations";
import {
  addLegacyProjectId,
  addLegacyProjectIdToList,
  normaliseProjectIdToWorkspaceId,
} from "@/modules/api/v2/organizations/[organizationId]/workspace-teams/lib/backwards-compat";
import { checkAuthenticationAndAccess } from "@/modules/api/v2/organizations/[organizationId]/workspace-teams/lib/utils";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import {
  createWorkspaceTeam,
  deleteWorkspaceTeam,
  getWorkspaceTeams,
  updateWorkspaceTeam,
} from "./lib/workspace-teams";
import {
  ZGetWorkspaceTeamUpdateFilter,
  ZGetWorkspaceTeamsFilter,
  ZWorkspaceTeamInput,
} from "./types/workspace-teams";

export async function GET(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    allowOrganizationOnlyApiKey: true,
    schemas: {
      query: ZGetWorkspaceTeamsFilter,
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

      const normalisedQuery = normaliseProjectIdToWorkspaceId(query!);
      const result = await getWorkspaceTeams(authentication.organizationId, normalisedQuery);

      if (!result.ok) {
        return handleApiError(request, result.error);
      }

      return responses.successResponse({
        ...result.data,
        data: addLegacyProjectIdToList(result.data.data),
      });
    },
  });
}

export async function POST(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    allowOrganizationOnlyApiKey: true,
    schemas: {
      body: ZWorkspaceTeamInput,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { body, params }, authentication, auditLog }) => {
      const normalisedBody = normaliseProjectIdToWorkspaceId(body!);
      const { teamId, workspaceId } = normalisedBody;

      if (!workspaceId) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "workspaceId", issue: "Either workspaceId or projectId must be provided" }],
        });
      }

      if (auditLog) {
        auditLog.targetId = `${workspaceId}-${teamId}`;
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

      const hasAccess = await checkAuthenticationAndAccess(teamId, workspaceId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error, auditLog);
      }

      // check if workspace team already exists
      const existingWorkspaceTeam = await getWorkspaceTeams(authentication.organizationId, {
        teamId,
        workspaceId,
        limit: 10,
        skip: 0,
        sortBy: "createdAt",
        order: "desc",
      });

      if (!existingWorkspaceTeam.ok) {
        return handleApiError(request, existingWorkspaceTeam.error, auditLog);
      }

      if (existingWorkspaceTeam.data.data.length > 0) {
        return handleApiError(
          request,
          {
            type: "conflict",
            details: [{ field: "workspaceTeam", issue: "Workspace team already exists" }],
          },
          auditLog
        );
      }
      const result = await createWorkspaceTeam({
        teamId,
        workspaceId,
        permission: normalisedBody.permission,
      });
      if (!result.ok) {
        return handleApiError(request, result.error, auditLog);
      }

      if (auditLog) {
        auditLog.newObject = result.data;
      }

      return responses.successResponse({ data: addLegacyProjectId(result.data) });
    },
    action: "created",
    targetType: "workspaceTeam",
  });
}

export async function PUT(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    allowOrganizationOnlyApiKey: true,
    schemas: {
      body: ZWorkspaceTeamInput,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { body, params }, authentication, auditLog }) => {
      const normalisedBody = normaliseProjectIdToWorkspaceId(body!);
      const { teamId, workspaceId } = normalisedBody;

      if (!workspaceId) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "workspaceId", issue: "Either workspaceId or projectId must be provided" }],
        });
      }

      if (auditLog) {
        auditLog.targetId = `${workspaceId}-${teamId}`;
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

      const hasAccess = await checkAuthenticationAndAccess(teamId, workspaceId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error, auditLog);
      }

      // Fetch old object for audit log
      let oldWorkspaceTeamData: any = UNKNOWN_DATA;
      try {
        const oldWorkspaceTeamResult = await getWorkspaceTeams(authentication.organizationId, {
          teamId,
          workspaceId,
          limit: 1,
          skip: 0,
          sortBy: "createdAt",
          order: "desc",
        });

        if (oldWorkspaceTeamResult.ok && oldWorkspaceTeamResult.data.data.length > 0) {
          oldWorkspaceTeamData = oldWorkspaceTeamResult.data.data[0];
        } else {
          logger.error(`Failed to fetch old workspace team data for audit log`);
        }
      } catch (error) {
        logger.error(error, `Failed to fetch old workspace team data for audit log`);
      }

      const result = await updateWorkspaceTeam(teamId, workspaceId, {
        permission: normalisedBody.permission,
      });
      if (!result.ok) {
        return handleApiError(request, result.error, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = oldWorkspaceTeamData;
        auditLog.newObject = result.data;
      }

      return responses.successResponse({ data: addLegacyProjectId(result.data) });
    },
    action: "updated",
    targetType: "workspaceTeam",
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ organizationId: string }> }) {
  return authenticatedApiClient({
    request,
    allowOrganizationOnlyApiKey: true,
    schemas: {
      query: ZGetWorkspaceTeamUpdateFilter,
      params: z.object({ organizationId: ZOrganizationIdSchema }),
    },
    externalParams: props.params,
    handler: async ({ parsedInput: { query, params }, authentication, auditLog }) => {
      const normalisedQuery = normaliseProjectIdToWorkspaceId(query!);
      const { teamId, workspaceId } = normalisedQuery;

      if (!workspaceId) {
        return handleApiError(request, {
          type: "bad_request",
          details: [{ field: "workspaceId", issue: "Either workspaceId or projectId must be provided" }],
        });
      }

      if (auditLog) {
        auditLog.targetId = `${workspaceId}-${teamId}`;
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

      const hasAccess = await checkAuthenticationAndAccess(teamId, workspaceId, authentication);

      if (!hasAccess.ok) {
        return handleApiError(request, hasAccess.error, auditLog);
      }

      // Fetch old object for audit log
      let oldWorkspaceTeamData: any = UNKNOWN_DATA;
      try {
        const oldWorkspaceTeamResult = await getWorkspaceTeams(authentication.organizationId, {
          teamId,
          workspaceId,
          limit: 1,
          skip: 0,
          sortBy: "createdAt",
          order: "desc",
        });

        if (oldWorkspaceTeamResult.ok && oldWorkspaceTeamResult.data.data.length > 0) {
          oldWorkspaceTeamData = oldWorkspaceTeamResult.data.data[0];
        } else {
          logger.error(`Failed to fetch old workspace team data for audit log`);
        }
      } catch (error) {
        logger.error(error, `Failed to fetch old workspace team data for audit log`);
      }

      const result = await deleteWorkspaceTeam(teamId, workspaceId);
      if (!result.ok) {
        return handleApiError(request, result.error, auditLog);
      }

      if (auditLog) {
        auditLog.oldObject = oldWorkspaceTeamData;
      }

      return responses.successResponse({ data: addLegacyProjectId(result.data) });
    },
    action: "deleted",
    targetType: "workspaceTeam",
  });
}
