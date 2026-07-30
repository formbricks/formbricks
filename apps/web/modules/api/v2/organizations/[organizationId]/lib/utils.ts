import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { hasApiKeyOrganizationAccess } from "@/modules/organization/settings/api-keys/lib/utils";

export const hasOrganizationIdAndAccess = async (
  paramOrganizationId: string,
  authentication: TAuthenticationApiKey,
  accessType: OrganizationAccessType
): Promise<boolean> => {
  if (paramOrganizationId !== authentication.organizationId) {
    logger.error("Organization ID from params does not match the authenticated organization ID");

    return false;
  }

  return hasApiKeyOrganizationAccess(authentication, accessType);
};
