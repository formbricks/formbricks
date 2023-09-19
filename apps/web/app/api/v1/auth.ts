import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { TAuthentication, TAuthenticationApiKey } from "@formbricks/types/v1/auth";

export async function getAuthentication(request: Request): Promise<TAuthentication | null> {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const apiKeyData = await getApiKeyFromKey(apiKey);
    if (apiKeyData) {
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId: apiKeyData.environmentId,
      };
      return authentication;
    }
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
