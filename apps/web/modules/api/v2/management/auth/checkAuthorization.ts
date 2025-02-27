import { ApiErrorResponse } from "@/modules/api/v2/types/api-error";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { Result, err, okVoid } from "@formbricks/types/error-handlers";

export const checkAuthorization = ({
  authentication,
  environmentId,
}: {
  authentication: TAuthenticationApiKey;
  environmentId: string;
}): Result<void, ApiErrorResponse> => {
  if (authentication.type === "apiKey" && authentication.environmentId !== environmentId) {
    return err({
      type: "unauthorized",
    });
  }
  return okVoid();
};
