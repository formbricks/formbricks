import { NextRequest } from "next/server";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { authenticateRequest } from "@/app/api/v1/auth";
import { can } from "@/lib/authorization";
import { getWorkspaceAuthorizationActionForMethod } from "@/lib/authorization/permission-action";
import { getSession } from "@/modules/auth/lib/session";

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
    const isUserAuthorized = await can(
      { type: "user", id: session.user.id },
      getWorkspaceAuthorizationActionForMethod(action),
      { type: "workspace", id: workspaceId }
    );
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

  if (
    !(await can({ type: "apiKey", id: auth.apiKeyId }, getWorkspaceAuthorizationActionForMethod(action), {
      type: "workspace",
      id: workspaceId,
    }))
  ) {
    return err({
      unauthorized: true,
    });
  }

  return ok({
    authType: "apiKey",
    apiKeyId: auth.apiKeyId,
  });
};
