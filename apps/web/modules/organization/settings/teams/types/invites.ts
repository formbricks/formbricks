import { z } from "zod";
import { ZInvite } from "@formbricks/database/zod/invites";
import { ZUserName } from "@formbricks/types/user";

export const ZInvitee = ZInvite.pick({
  email: true,
  role: true,
  teamIds: true,
}).extend({
  name: ZUserName,
});

export type TInvitee = z.infer<typeof ZInvitee>;
