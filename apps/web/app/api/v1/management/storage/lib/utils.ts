import { responses } from "@/app/lib/api/response";
import { TApiV1Authentication } from "@/app/lib/api/with-api-logging";
import { can } from "@/lib/authorization";

export const checkAuth = async (authentication: TApiV1Authentication | undefined, workspaceId: string) => {
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }

  if ("user" in authentication) {
    const isUserAuthorized = await can({ type: "user", id: authentication.user.id }, "workspace.write", {
      type: "workspace",
      id: workspaceId,
    });
    if (!isUserAuthorized) {
      return responses.unauthorizedResponse();
    }
  } else if ("apiKeyId" in authentication) {
    if (
      !(await can({ type: "apiKey", id: authentication.apiKeyId }, "workspace.write", {
        type: "workspace",
        id: workspaceId,
      }))
    ) {
      return responses.unauthorizedResponse();
    }
  } else {
    return responses.notAuthenticatedResponse();
  }
};
