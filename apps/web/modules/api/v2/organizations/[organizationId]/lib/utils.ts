import { logger } from "@formbricks/logger";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { can } from "@/lib/authorization";
import { getOrganizationAuthorizationActionForAccessType } from "@/lib/authorization/permission-action";

export const hasOrganizationIdAndAccess = async (
  paramOrganizationId: string,
  authentication: TAuthenticationApiKey,
  accessType: OrganizationAccessType
): Promise<boolean> => {
  if (paramOrganizationId !== authentication.organizationId) {
    logger.error("Organization ID from params does not match the authenticated organization ID");

    return false;
  }

  return can(
    { type: "apiKey", id: authentication.apiKeyId },
    getOrganizationAuthorizationActionForAccessType(accessType),
    { type: "organization", id: authentication.organizationId }
  );
};
