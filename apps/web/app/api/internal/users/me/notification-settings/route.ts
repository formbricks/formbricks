import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getNotificationSettingsOperation, updateNotificationSettingOperation } from "../lib/operations";
import { ZNotificationSettingPatchBody } from "../schemas";

/** `GET /api/internal/users/me/notification-settings`: every switch on the notifications page. */
export const GET = withV3ApiWrapper({
  auth: "session",
  handler: async ({ authentication, requestId, instance }) =>
    getNotificationSettingsOperation({ authentication, requestId, instance }),
});

/** `PATCH /api/internal/users/me/notification-settings`: flip one switch; answers with every switch. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZNotificationSettingPatchBody },
  action: "updated",
  targetType: "user",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateNotificationSettingOperation({
      authentication,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
