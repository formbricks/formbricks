import { getEnvironmentIdFromApiKey } from "@/modules/api/v2/management/lib/api-key";
import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { ApiErrorResponse } from "@/modules/api/v2/types/api-error";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const authenticateRequest = async (
  request: Request
): Promise<Result<TAuthenticationApiKey, ApiErrorResponse>> => {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const environmentIdResult = await getEnvironmentIdFromApiKey(apiKey);
    if (!environmentIdResult.ok) {
      return err(environmentIdResult.error);
    }
    const environmentId = environmentIdResult.data;
    const hashedApiKey = hashApiKey(apiKey);
    if (environmentId) {
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId,
        hashedApiKey,
      };
      return ok(authentication);
    }
    return err({
      type: "forbidden",
    });
  }
  return err({
    type: "unauthorized",
  });
};
