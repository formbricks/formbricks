import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const authenticateRequest = async (
  request: Request
): Promise<Result<TAuthenticationApiKey, ApiErrorResponseV2>> => {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return err({ type: "unauthorized" });

  const apiKeyData = await getApiKeyWithPermissions(apiKey);
  if (!apiKeyData) return err({ type: "unauthorized" });

  const hashedApiKey = hashApiKey(apiKey);

  const authentication: TAuthenticationApiKey = {
    type: "apiKey",
    environmentPermissions: apiKeyData.apiKeyEnvironments.map((env) => ({
      environmentId: env.environmentId,
      permission: env.permission,
    })),
    hashedApiKey,
    apiKeyId: apiKeyData.id,
    organizationId: apiKeyData.organizationId,
    organizationAccess: apiKeyData.organizationAccess,
  };
  return ok(authentication);
};
