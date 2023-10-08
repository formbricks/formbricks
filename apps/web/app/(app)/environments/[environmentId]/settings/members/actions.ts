"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { createInviteToken } from "@formbricks/lib/jwt";
import { AuthenticationError, AuthorizationError, ValidationError } from "@formbricks/types/v1/errors";
import {
  deleteInvite,
  getInviteToken,
  inviteUser,
  resendInvite,
  updateInvite,
} from "@formbricks/lib/invite/service";
import {
  deleteMembership,
  getMembershipsByUserId,
  getMembershipByUserIdTeamId,
  transferOwnership,
  updateMembership,
} from "@formbricks/lib/membership/service";
import { deleteTeam, updateTeam } from "@formbricks/lib/team/service";
import { TInviteUpdateInput } from "@formbricks/types/v1/invites";
import { TMembershipRole, TMembershipUpdateInput } from "@formbricks/types/v1/memberships";
import { getServerSession } from "next-auth";
import { hasTeamAccess, hasTeamAuthority, hasTeamOwnership, isOwner } from "@formbricks/lib/auth";
import { INVITE_DISABLED } from "@formbricks/lib/constants";

export const updateTeamNameAction = async (teamId: string, teamName: string) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(session.user.id, teamId);
  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  return await updateTeam(teamId, { name: teamName });
};

export const updateMembershipAction = async (
  userId: string,
  teamId: string,
  data: TMembershipUpdateInput
) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(session.user.id, teamId);

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  return await updateMembership(userId, teamId, data);
};

export const updateInviteAction = async (inviteId: string, teamId: string, data: TInviteUpdateInput) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(session.user.id, teamId);

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  return await updateInvite(inviteId, data);
};

export const deleteInviteAction = async (inviteId: string, teamId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(session.user.id, teamId);

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  return await deleteInvite(inviteId);
};

export const deleteMembershipAction = async (userId: string, teamId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(session.user.id, teamId);

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  if (userId === session.user.id) {
    throw new AuthenticationError("You cannot delete yourself from the team");
  }

  return await deleteMembership(userId, teamId);
};

export const leaveTeamAction = async (teamId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const membership = await getMembershipByUserIdTeamId(session.user.id, teamId);

  if (!membership) {
    throw new AuthenticationError("Not a member of this team");
  }

  if (membership.role === "owner") {
    throw new ValidationError("You cannot leave a team you own");
  }

  const memberships = await getMembershipsByUserId(session.user.id);
  if (!memberships || memberships?.length <= 1) {
    throw new ValidationError("You cannot leave the only team you are a member of");
  }

  await deleteMembership(session.user.id, teamId);
};

export const createInviteTokenAction = async (inviteId: string) => {
  const { email } = await getInviteToken(inviteId);

  const inviteToken = createInviteToken(inviteId, email, {
    expiresIn: "7d",
  });

  return { inviteToken: encodeURIComponent(inviteToken) };
};

export const resendInviteAction = async (inviteId: string) => {
  return await resendInvite(inviteId);
};

export const inviteUserAction = async (
  teamId: string,
  email: string,
  name: string,
  role: TMembershipRole
) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(session.user.id, teamId);

  if (INVITE_DISABLED) {
    throw new AuthenticationError("Invite disabled");
  }

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  const invite = await inviteUser({
    teamId,
    currentUser: { id: session.user.id, name: session.user.name },
    invitee: {
      email,
      name,
      role,
    },
  });

  return invite;
};

export const transferOwnershipAction = async (teamId: string, newOwnerId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const hasAccess = await hasTeamAccess(session.user.id, teamId);
  if (!hasAccess) {
    throw new AuthorizationError("Not authorized");
  }

  const isUserOwner = await isOwner(session.user.id, teamId);
  if (!isUserOwner) {
    throw new AuthorizationError("Not authorized");
  }

  if (newOwnerId === session.user.id) {
    throw new ValidationError("You are already the owner of this team");
  }

  const membership = await getMembershipByUserIdTeamId(newOwnerId, teamId);
  if (!membership) {
    throw new ValidationError("User is not a member of this team");
  }

  await transferOwnership(session.user.id, newOwnerId, teamId);
};

export const deleteTeamAction = async (teamId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserTeamOwner = await hasTeamOwnership(session.user.id, teamId);
  if (!isUserTeamOwner) {
    throw new AuthorizationError("Not authorized");
  }

  return await deleteTeam(teamId);
};
