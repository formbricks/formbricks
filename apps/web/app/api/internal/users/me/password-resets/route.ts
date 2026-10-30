import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requestPasswordResetOperation } from "../lib/operations";

/** `POST /api/internal/users/me/password-resets`: email yourself a password reset link. */
export const POST = withV3ApiWrapper({
  auth: "session",
  action: "passwordReset",
  targetType: "user",
  handler: async ({ authentication, requestId, instance, auditLog }) =>
    requestPasswordResetOperation({ authentication, requestId, instance, auditLog }),
});
