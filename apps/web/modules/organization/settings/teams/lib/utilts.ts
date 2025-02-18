import { TInvite } from "@/modules/organization/settings/teams/types/invites";

export const isInviteExpired = (invite: TInvite) => {
  const now = new Date();
  const expiresAt = new Date(invite.expiresAt);
  return now > expiresAt;
};
