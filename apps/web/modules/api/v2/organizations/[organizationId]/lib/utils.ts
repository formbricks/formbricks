import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { TAuthenticationApiKey } from "@formbricks/types/auth";

export const hasOrganizationIdAndAccess = (
  paramOrganizationId: string,
  authentication: TAuthenticationApiKey,
  accessType: OrganizationAccessType
): boolean => {
  if (!authentication.organizationId) {
    logger.error("Organization ID is missing from the authentication object");

    return false;
  }

  if (paramOrganizationId !== authentication.organizationId) {
    logger.error("Organization ID from params does not match the authenticated organization ID");

    return false;
  }

  if (!authentication.organizationAccess?.accessControl?.[accessType]) {
    return false;
  }

  return true;
};
