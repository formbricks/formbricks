import { OrganizationAccessType } from "@formbricks/types/api-key";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getEnvironmentIdsByOrganizationId } from "@/lib/environment/organization";
import { hasOrganizationAccess, hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const getReadableEnvironmentIds = async (authentication: TAuthenticationApiKey): Promise<string[]> => {
  if (hasOrganizationAccess(authentication, OrganizationAccessType.Read)) {
    return getEnvironmentIdsByOrganizationId(authentication.organizationId);
  }

  const environmentIds = authentication.environmentPermissions
    .filter((permission) =>
      hasPermission(authentication.environmentPermissions, permission.environmentId, "GET")
    )
    .map((permission) => permission.environmentId);

  return Array.from(new Set(environmentIds));
};
