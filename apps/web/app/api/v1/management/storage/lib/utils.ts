import { responses } from "@/app/lib/api/response";
import { TApiV1Authentication } from "@/app/lib/api/with-api-logging";
import { hasUserWorkspaceAccessForAction } from "@/lib/workspace/auth";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const checkAuth = async (authentication: TApiV1Authentication | undefined, workspaceId: string) => {
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }

  if ("user" in authentication) {
    const isUserAuthorized = await hasUserWorkspaceAccessForAction(
      authentication.user.id,
      workspaceId,
      "POST"
    );
    if (!isUserAuthorized) {
      return responses.unauthorizedResponse();
    }
  } else if ("apiKeyId" in authentication) {
    if (!hasPermission(authentication.workspacePermissions, workspaceId, "POST")) {
      return responses.unauthorizedResponse();
    }
  } else {
    return responses.notAuthenticatedResponse();
  }
};
