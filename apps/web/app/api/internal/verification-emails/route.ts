import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { resendVerificationEmailOperation } from "./lib/operations";
import { ZVerificationEmailBody } from "./schemas";

/** `POST /api/internal/verification-emails`: send a new verification (or SSO recovery) email (pre-login). */
export const POST = withV3ApiWrapper({
  auth: "none",
  schemas: { body: ZVerificationEmailBody },
  bodyLimitBytes: PRE_LOGIN_BODY_LIMIT_BYTES,
  action: "verificationEmailSent",
  targetType: "user",
  handler: async ({ parsedInput, requestId, instance, auditLog }) =>
    resendVerificationEmailOperation({ body: parsedInput.body, requestId, instance, auditLog }),
});
