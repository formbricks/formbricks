"use server";

import { getServerSession } from "next-auth";

import { hasTeamAuthority } from "@formbricks/lib/auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { deleteInvite, getInvite, inviteUser, resendInvite } from "@formbricks/lib/invite/service";
import { createInviteToken } from "@formbricks/lib/jwt";
import {
  deleteMembership,
  getMembershipByUserIdTeamId,
  getMembershipsByUserId,
} from "@formbricks/lib/membership/service";
import { verifyUserRoleAccess } from "@formbricks/lib/team/auth";
import { deleteTeam, updateTeam } from "@formbricks/lib/team/service";
import { AuthenticationError, AuthorizationError, ValidationError } from "@formbricks/types/errors";
import { TMembershipRole } from "@formbricks/types/memberships";

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

export const updateTeamSupportEmailAction = async (teamId: string, supportEmail: string) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasTeamAuthority(session.user.id, teamId);
  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  return await updateTeam(teamId, { supportEmail: supportEmail });
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

  const { hasDeleteMembersAccess } = await verifyUserRoleAccess(teamId, session.user.id);
  if (!hasDeleteMembersAccess) {
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
  const { email } = await getInvite(inviteId);
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

  const { hasCreateOrUpdateMembersAccess } = await verifyUserRoleAccess(teamId, session.user.id);
  if (!hasCreateOrUpdateMembersAccess) {
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

export const deleteTeamAction = async (teamId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const { hasDeleteAccess } = await verifyUserRoleAccess(teamId, session.user.id);

  if (!hasDeleteAccess) {
    throw new AuthorizationError("Not authorized");
  }

  return await deleteTeam(teamId);
};
