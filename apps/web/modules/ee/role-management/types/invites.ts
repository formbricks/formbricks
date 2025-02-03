import { z } from "zod";
import { ZInvite } from "@formbricks/database/zod/invites";

export const ZInviteUpdateInput = ZInvite.pick({
  role: true,
});

export type TInviteUpdateInput = z.infer<typeof ZInviteUpdateInput>;
