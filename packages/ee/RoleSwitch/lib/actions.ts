"use server";

import { authOptions } from "../../../lib/authOptions";
import {
  getMembershipByUserIdTeamId,
  transferOwnership,
  updateMembership,
} from "../../../lib/membership/service";
import { updateInvite } from "../../../lib/invite/service";
import { TInviteUpdateInput } from "../../../types/invites";
import { TMembershipUpdateInput } from "../../../types/memberships";
import { hasTeamAccess, hasTeamAuthority, isOwner } from "../../../lib/auth";
import { getServerSession } from "next-auth";
import { AuthenticationError, AuthorizationError, ValidationError } from "../../../types/errors";
import { TProfile } from "../../../types/profile";

export const transferOwnershipAction = async (teamId: string, newOwnerId: string) => {
  const session = await getServerSession(authOptions);
  const user = session?.user as TProfile;
  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  if (!user) {
    throw new AuthenticationError("Not authenticated");
  }

  const hasAccess = await hasTeamAccess(user.id, teamId);
  if (!hasAccess) {
    throw new AuthorizationError("Not authorized");
  }

  const isUserOwner = await isOwner(user.id, teamId);
  if (!isUserOwner) {
    throw new AuthorizationError("Not authorized");
  }

  if (newOwnerId === user.id) {
    throw new ValidationError("You are already the owner of this team");
  }

  const membership = await getMembershipByUserIdTeamId(newOwnerId, teamId);
  if (!membership) {
    throw new ValidationError("User is not a member of this team");
  }

  await transferOwnership(user.id, newOwnerId, teamId);
};

export const updateInviteAction = async (inviteId: string, teamId: string, data: TInviteUpdateInput) => {
  const session = await getServerSession(authOptions);
  const user = session?.user as TProfile;

  if (!user) {
    throw new AuthenticationError("Not authenticated");
  }

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(user.id, teamId);

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  return await updateInvite(inviteId, data);
};

export const updateMembershipAction = async (
  userId: string,
  teamId: string,
  data: TMembershipUpdateInput
) => {
  const session = await getServerSession(authOptions);
  const user = session?.user as TProfile;

  if (!user) {
    throw new AuthenticationError("Not authenticated");
  }

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(user.id, teamId);

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  return await updateMembership(userId, teamId, data);
};
