"use server";

import { hasTeamAccess, isAdminOrOwner } from "@/lib/api/apiHelper";
import { AuthenticationError } from "@formbricks/errors";
import { updateInvite } from "@formbricks/lib/services/invite";
import { updateMembership } from "@formbricks/lib/services/membership";
import { updateTeam } from "@formbricks/lib/services/team";
import { TInviteUpdateInput } from "@formbricks/types/v1/invites";
import { TMembershipUpdateInput } from "@formbricks/types/v1/memberships";
import { TTeamUpdateInput } from "@formbricks/types/v1/teams";
import { getServerSession } from "next-auth";

export const updateTeamAction = async (teamId: string, data: TTeamUpdateInput) => {
  return await updateTeam(teamId, data);
};

export const updateMembershipAction = async (
  userId: string,
  teamId: string,
  data: TMembershipUpdateInput
) => {
  const session = await getServerSession();

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const hasAccess = await hasTeamAccess({ id: userId }, teamId);
  if (!hasAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const hasOwnerOrAdminAccess = await isAdminOrOwner({ id: userId }, teamId);
  if (!hasOwnerOrAdminAccess) {
    throw new AuthenticationError("You are not allowed to update member's role in this team");
  }

  return await updateMembership(userId, teamId, data);
};

export const updateInviteAction = async (inviteId: string, data: TInviteUpdateInput) => {
  return await updateInvite(inviteId, data);
};
