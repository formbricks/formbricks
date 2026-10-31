import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createOnboardingInviteOperation } from "./lib/operations";
import { ZOnboardingInviteBody } from "./schemas";

/** `POST /api/internal/onboarding-invites`: invite a teammate from the setup screen. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZOnboardingInviteBody },
  action: "created",
  targetType: "invite",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createOnboardingInviteOperation({
      authentication,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
