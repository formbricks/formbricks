import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { completePasswordResetOperation } from "./lib/operations";
import { ZPasswordResetBody } from "./schemas";

/** `POST /api/internal/password-resets`: set a new password from a reset link (pre-login). */
export const POST = withV3ApiWrapper({
  auth: "none",
  bodyLimitBytes: PRE_LOGIN_BODY_LIMIT_BYTES,
  schemas: { body: ZPasswordResetBody },
  handler: async ({ parsedInput, requestId, instance }) =>
    completePasswordResetOperation({ body: parsedInput.body, requestId, instance }),
});
