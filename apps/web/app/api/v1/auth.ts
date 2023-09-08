import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { getEnvironmentBySession } from "@formbricks/lib/services/environment";
import { TAuthentication, TAuthenticationApiKey, TAuthenticationSession } from "@formbricks/types/v1/auth";

export async function getAuthentication(request: Request): Promise<TAuthentication | null> {
  const apiKey = request.headers.get("x-api-key");
  const session = await getServerSession(authOptions);

  if (apiKey) {
    const apiKeyData = await getApiKeyFromKey(apiKey);
    if (apiKeyData) {
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId: apiKeyData.environmentId,
      };
      return authentication;
    }
  } else if (session) {
    const environmentData = await getEnvironmentBySession(session.user);
    const authentication: TAuthenticationSession = {
      type: "session",
      session: session,
      environmentId: environmentData?.id,
    };
    return authentication;
  }
  return null;
}
export async function authenticateRequest(request: Request): Promise<TAuthentication> {
  const authentication = await getAuthentication(request);
  if (!authentication) {
    throw new Error("NotAuthenticated");
  }
  return authentication;
}
