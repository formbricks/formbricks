import { responses } from "@/app/lib/api/response";
import { TApiV1Authentication } from "@/app/lib/api/with-api-logging";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const checkAuth = async (authentication: TApiV1Authentication, environmentId: string) => {
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }

  if ("user" in authentication) {
    const isUserAuthorized = await hasUserEnvironmentAccess(authentication.user.id, environmentId);
    if (!isUserAuthorized) {
      return responses.unauthorizedResponse();
    }
  } else if ("apiKeyId" in authentication) {
    if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
      return responses.unauthorizedResponse();
    }
  } else {
    return responses.notAuthenticatedResponse();
  }
};
