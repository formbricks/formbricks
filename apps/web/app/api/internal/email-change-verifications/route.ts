import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { verifyEmailChangeOperation } from "./lib/operations";
import { ZEmailChangeVerificationBody } from "./schemas";

/** `POST /api/internal/email-change-verifications`: confirm a new email address (pre-login). */
export const POST = withV3ApiWrapper({
  auth: "none",
  schemas: { body: ZEmailChangeVerificationBody },
  action: "updated",
  targetType: "user",
  handler: async ({ parsedInput, requestId, instance, auditLog }) =>
    verifyEmailChangeOperation({ body: parsedInput.body, requestId, instance, auditLog }),
});
