import { handleApiError } from "@/modules/api/v2/lib/utils";
import { logger } from "@formbricks/logger";

export const checkOrganizationId = (paramOrganizationId: string, authentication) => {
  if (!organizationId) {
    logger.error("Organization ID is missing from the authentication object");

    return handleApiError(request, {
      type: "unauthorized",
    });
  }

  if (params!.organizationId !== authentication.organizationId) {
    logger.error("Organization ID from params does not match the authenticated organization ID");

    return handleApiError(request, {
      type: "unauthorized",
      details: [{ field: "organizationId", issue: "unauthorized" }],
    });
  }

  if (!authentication.organizationAccess?.accessControl?.read) {
    return handleApiError(request, {
      type: "unauthorized",
      details: [{ field: "organizationId", issue: "unauthorized" }],
    });
  }
};
