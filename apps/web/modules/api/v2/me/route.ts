import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { responses } from "@/modules/api/v2/lib/response";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { hasOrganizationAccess } from "@/modules/organization/settings/api-keys/lib/utils";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    allowOrganizationOnlyApiKey: true,
    handler: async ({ authentication }) => {
      if (!hasOrganizationAccess(authentication, OrganizationAccessType.Read)) {
        return handleApiError(request, {
          type: "unauthorized",
          details: [{ field: "organizationId", issue: "unauthorized" }],
        });
      }

      const workspaceIds = authentication.workspacePermissions.map((p) => p.workspaceId);
      const workspaces = await prisma.workspace.findMany({
        where: { id: { in: workspaceIds } },
        select: { id: true, legacyEnvironmentId: true },
      });

      const legacyEnvIdByWorkspaceId = new Map(workspaces.map((w) => [w.id, w.legacyEnvironmentId]));
      const workspacePermissions = authentication.workspacePermissions.map((permission) => ({
        permissions: permission.permission,
        workspaceId: permission.workspaceId,
        workspaceName: permission.workspaceName,
      }));

      // Backwards compat: expose environment-shaped permissions for consumers
      // from before the Environment model was removed.
      const environmentPermissions = authentication.workspacePermissions.flatMap((permission) => {
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
