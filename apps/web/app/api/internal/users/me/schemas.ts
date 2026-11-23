import { z } from "zod";
import { ZUserName, ZUserPersonalInfoUpdateInput } from "@formbricks/types/user";
import { SIGNUP_NAME_MAX } from "@/app/api/internal/signups/schemas";

/**
 * `PATCH /api/internal/users/me` body. A changed email needs the current password (checked by the
 * operation). The name gets the cap a sign-up gives it; `ZUserName` has no upper bound of its own.
 */
export const ZProfilePatchBody = ZUserPersonalInfoUpdateInput.extend({
  name: ZUserName.max(SIGNUP_NAME_MAX).optional(),
}).strict();
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
