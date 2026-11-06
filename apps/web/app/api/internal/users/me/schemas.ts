import { z } from "zod";
import { ZUserPersonalInfoUpdateInput } from "@formbricks/types/user";

/** `PATCH /api/internal/users/me` body. A changed email needs the current password (checked by the operation). */
export const ZProfilePatchBody = ZUserPersonalInfoUpdateInput.strict();
export type TProfilePatchBody = z.infer<typeof ZProfilePatchBody>;

/**
 * `PATCH /api/internal/users/me/notification-settings` body: one switch, applied on the server to the stored
 * settings, so a request can't write back a whole settings object copied from a stale page. The apply is
 * still an unlocked read-modify-write (`updateNotificationSetting`): two requests in flight at once can lose
 * one change. A page sends its switches one at a time (`useUpdateNotificationSetting`'s mutation scope), so
 * only requests from two tabs or clients can still race. Survey and organization ids aren't
 * checked against the caller's access: a setting only ever affects the caller's own email, and alerts go
 * only to members who may read the survey (ENG-3282).
 */
export const ZNotificationSettingPatchBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("alert"), surveyId: z.cuid2(), enabled: z.boolean() }).strict(),
  z
    .object({ type: z.literal("organizationEmails"), organizationId: z.cuid2(), subscribed: z.boolean() })
    .strict(),
]);
export type TNotificationSettingPatchBody = z.infer<typeof ZNotificationSettingPatchBody>;
