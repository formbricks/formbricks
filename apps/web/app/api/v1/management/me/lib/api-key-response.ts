import { OrganizationAccessType } from "@formbricks/types/api-key";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getEnvironment } from "@/lib/environment/service";
import { hasOrganizationAccess } from "@/modules/organization/settings/api-keys/lib/utils";

const buildApiKeyMetadataResponse = (authentication: TAuthenticationApiKey) => ({
  environmentPermissions: authentication.environmentPermissions.map((permission) => ({
    environmentId: permission.environmentId,
    environmentType: permission.environmentType,
    permissions: permission.permission,
    projectId: permission.projectId,
    projectName: permission.projectName,
  })),
  organizationId: authentication.organizationId,
  organizationAccess: authentication.organizationAccess,
});

export const buildApiKeyMeResponse = async (
  authentication: TAuthenticationApiKey
): Promise<Response | null> => {
  const environmentPermissionCount = authentication.environmentPermissions.length;

  if (environmentPermissionCount !== 1) {
    if (hasOrganizationAccess(authentication, OrganizationAccessType.Read)) {
      return Response.json(buildApiKeyMetadataResponse(authentication));
    }

    return null;
  }

  const permission = authentication.environmentPermissions[0];
  const environment = await getEnvironment(permission.environmentId);

  if (!environment) {
    return null;
  }

  return Response.json({
    id: environment.id,
    type: environment.type,
    createdAt: environment.createdAt,
    updatedAt: environment.updatedAt,
    appSetupCompleted: environment.appSetupCompleted,
    project: {
      id: permission.projectId,
      name: permission.projectName,
    },
  });
};
