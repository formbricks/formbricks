import { authenticateRequest } from "@/app/api/v1/auth";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const authorizePrivateDownload = async (
  request: NextRequest,
  environmentId: string,
  action: "GET" | "DELETE"
): Promise<
  Result<
    { authType: "session"; userId: string } | { authType: "apiKey"; hashedApiKey: string },
    {
      unauthorized: boolean;
    }
  >
> => {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
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

  if (!hasPermission(auth.environmentPermissions, environmentId, action)) {
    return err({
      unauthorized: true,
    });
  }

  return ok({
    authType: "apiKey",
    hashedApiKey: auth.hashedApiKey,
  });
};
