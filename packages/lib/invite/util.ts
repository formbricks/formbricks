import "server-only";

import { TInvite } from "@formbricks/types/invites";

export const formatInviteDateFields = (invite: TInvite): TInvite => {
  if (typeof invite.createdAt === "string") {
    invite.createdAt = new Date(invite.createdAt);
  }
  if (typeof invite.expiresAt === "string") {
    invite.expiresAt = new Date(invite.expiresAt);
  }

  return invite;
};
