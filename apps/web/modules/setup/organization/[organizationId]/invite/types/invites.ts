import { z } from "zod";
import { ZInvite } from "@formbricks/database/zod/invites";
import { ZUserName } from "@formbricks/types/user";

export const ZInvitee = ZInvite.pick({
  name: true,
  email: true,
}).extend({
  name: ZUserName,
});

export type TInvitee = z.infer<typeof ZInvitee>;

export const ZInviteMembersFormSchema = z.record(
  ZInvite.pick({
    email: true,
    name: true,
  }).extend({
    email: z.string().email("Invalid email address"),
    name: ZUserName,
  })
);

export type TInviteMembersFormSchema = z.infer<typeof ZInviteMembersFormSchema>;
