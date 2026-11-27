import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requestPasswordResetOperation } from "./lib/operations";
import { ZPasswordResetRequestBody } from "./schemas";

/** `POST /api/internal/password-reset-requests`: ask for a password reset link (pre-login). */
export const POST = withV3ApiWrapper({
  auth: "none",
  schemas: { body: ZPasswordResetRequestBody },
  bodyLimitBytes: PRE_LOGIN_BODY_LIMIT_BYTES,
  action: "passwordReset",
  targetType: "user",
  handler: async ({ parsedInput, requestId, instance, auditLog }) =>
    requestPasswordResetOperation({ body: parsedInput.body, requestId, instance, auditLog }),
});
