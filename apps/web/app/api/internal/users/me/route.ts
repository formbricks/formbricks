import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { updateProfileOperation } from "./lib/operations";
import { ZProfilePatchBody } from "./schemas";

/** `PATCH /api/internal/users/me`: change your own name, locale or email address. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZProfilePatchBody },
  action: "updated",
  targetType: "user",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateProfileOperation({ authentication, body: parsedInput.body, requestId, instance, auditLog }),
});
