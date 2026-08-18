import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { can } from "@/lib/authorization";
import { getOrganizationAuthorizationActionForAccessType } from "@/lib/authorization/permission-action";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    allowOrganizationOnlyApiKey: true,
    handler: async ({ authentication }) => {
      if (
        !(await can(
          { type: "apiKey", id: authentication.apiKeyId },
          getOrganizationAuthorizationActionForAccessType(OrganizationAccessType.Read),
          { type: "organization", id: authentication.organizationId }
        ))
      ) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const workspaceIds = await lookupAuthorizedWorkspaceIds({
        id: authentication.apiKeyId,
        type: "apiKey",
      });
      const authorizedWorkspaceIds = new Set(workspaceIds);
      const authorizedWorkspacePermissions = authentication.workspacePermissions.filter((permission) =>
        authorizedWorkspaceIds.has(permission.workspaceId)
      );
      const workspaces = await prisma.workspace.findMany({
        where: {
          id: { in: authorizedWorkspacePermissions.map(({ workspaceId }) => workspaceId) },
          organizationId: authentication.organizationId,
        },
        select: { id: true, legacyEnvironmentId: true },
      });

      const legacyEnvIdByWorkspaceId = new Map(workspaces.map((w) => [w.id, w.legacyEnvironmentId]));
      const workspacePermissions = authorizedWorkspacePermissions.map((permission) => ({
        permissions: permission.permission,
        workspaceId: permission.workspaceId,
        workspaceName: permission.workspaceName,
      }));

      // Backwards compat: expose environment-shaped permissions for consumers
      // from before the Environment model was removed.
      const environmentPermissions = authorizedWorkspacePermissions.flatMap((permission) => {
        const legacyEnvironmentId = legacyEnvIdByWorkspaceId.get(permission.workspaceId);
        if (!legacyEnvironmentId) return [];
        return [
          {
            environmentId: legacyEnvironmentId,
            environmentType: "production" as const,
            permissions: permission.permission,
            projectId: permission.workspaceId,
            projectName: permission.workspaceName,
          },
        ];
      });

      return responses.successResponse({
        data: {
          workspacePermissions,
          environmentPermissions,
          organizationId: authentication.organizationId,
          organizationAccess: authentication.organizationAccess,
        },
      });
    },
  });
