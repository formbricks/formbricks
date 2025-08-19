import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { TAuthenticationApiKey } from "@formbricks/types/auth";

export const hasOrganizationAccess = (
  authentication: TAuthenticationApiKey,
  accessType: OrganizationAccessType
): boolean => {
  const organizationAccess = authentication.organizationAccess?.accessControl;

  switch (accessType) {
    case OrganizationAccessType.Read:
      return organizationAccess?.read === true || organizationAccess?.write === true;
    case OrganizationAccessType.Write:
      return organizationAccess?.write === true;
    default:
      return false;
  }
};

export const hasOrganizationIdAndAccess = (
  paramOrganizationId: string,
  authentication: TAuthenticationApiKey,
  accessType: OrganizationAccessType
): boolean => {
  if (paramOrganizationId !== authentication.organizationId) {
    logger.error("Organization ID from params does not match the authenticated organization ID");

    return false;
  }

  return hasOrganizationAccess(authentication, accessType);
};
