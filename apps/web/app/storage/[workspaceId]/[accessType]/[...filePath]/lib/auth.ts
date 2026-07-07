import { NextRequest } from "next/server";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { authenticateRequest } from "@/app/api/v1/auth";
import { hasUserWorkspaceAccessForAction } from "@/lib/workspace/auth";
import { getSession } from "@/modules/auth/lib/session";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const authorizePrivateDownload = async (
  request: NextRequest,
  workspaceId: string,
  action: "GET" | "DELETE"
): Promise<
  Result<
    { authType: "session"; userId: string } | { authType: "apiKey"; apiKeyId: string },
    {
      unauthorized: boolean;
    }
  >
> => {
  const session = await getSession();

  if (session?.user) {
    const isUserAuthorized = await hasUserWorkspaceAccessForAction(session.user.id, workspaceId, action);
    if (!isUserAuthorized) {
      return err({
        unauthorized: true,
      });
    }

    return ok({
      authType: "session",
      userId: session.user.id,
    });
  }

  const auth = await authenticateRequest(request);
  if (!auth) {
    return err({
      unauthorized: false,
    });
  }

  if (!hasPermission(auth.workspacePermissions, workspaceId, action)) {
    return err({
      unauthorized: true,
    });
  }

  return ok({
    authType: "apiKey",
    apiKeyId: auth.apiKeyId,
  });
};
