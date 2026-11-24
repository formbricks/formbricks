import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createSignupOperation } from "./lib/operations";
import { ZSignupBody } from "./schemas";

/** `POST /api/internal/signups`: create a credential account (pre-login). */
export const POST = withV3ApiWrapper({
  auth: "none",
  schemas: { body: ZSignupBody },
  bodyLimitBytes: PRE_LOGIN_BODY_LIMIT_BYTES,
  action: "created",
  targetType: "user",
  handler: async ({ parsedInput, requestId, instance, auditLog }) =>
    createSignupOperation({ body: parsedInput.body, requestId, instance, auditLog }),
});
