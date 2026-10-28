import { z } from "zod";
import { ZUuid } from "@formbricks/types/common";
import { ZInviteUpdateInput } from "@/modules/ee/role-management/types/invites";

/** `/api/internal/invites/{inviteId}` path. */
export const ZInviteIdParams = z.object({ inviteId: ZUuid }).strict();

/** `PATCH /api/internal/invites/{inviteId}` body: the role the invitee joins with. */
export const ZInviteUpdateBody = ZInviteUpdateInput.strict();
export type TInviteUpdateBody = z.infer<typeof ZInviteUpdateBody>;
