import { z } from "zod";
import { ZUserPersonalInfoUpdateInput } from "@formbricks/types/user";

/** `PATCH /api/internal/users/me` body. A changed email needs the current password (checked by the operation). */
export const ZProfilePatchBody = ZUserPersonalInfoUpdateInput.strict();
export type TProfilePatchBody = z.infer<typeof ZProfilePatchBody>;

/**
 * `PATCH /api/internal/users/me/notification-settings` body: one switch. Applied on the server to the stored
 * settings, so concurrent switches can't overwrite each other (whole-object writes from two stale copies
 * could). Survey and organization ids aren't checked against the caller's access: a setting only ever
 * affects the caller's own email, and alerts go only to members who may read the survey (ENG-3282).
 */
export const ZNotificationSettingPatchBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("alert"), surveyId: z.cuid2(), enabled: z.boolean() }).strict(),
  z
    .object({ type: z.literal("organizationEmails"), organizationId: z.cuid2(), subscribed: z.boolean() })
    .strict(),
]);
export type TNotificationSettingPatchBody = z.infer<typeof ZNotificationSettingPatchBody>;
