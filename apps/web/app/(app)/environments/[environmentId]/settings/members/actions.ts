"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasTeamAccess, isAdminOrOwner } from "@/lib/api/apiHelper";
import { createInviteToken } from "@formbricks/lib/jwt";
import { AuthenticationError, ResourceNotFoundError } from "@formbricks/errors";
import { deleteInvite, getInviteToken, resendInvite, updateInvite } from "@formbricks/lib/services/invite";
import { deleteMembership, updateMembership } from "@formbricks/lib/services/membership";
import { updateTeam } from "@formbricks/lib/services/team";
import { TInviteUpdateInput } from "@formbricks/types/v1/invites";
import { TMembershipUpdateInput } from "@formbricks/types/v1/memberships";
import { TTeamUpdateInput } from "@formbricks/types/v1/teams";
import { getServerSession } from "next-auth";
import { prisma } from "@formbricks/database";
import { sendInviteMemberEmail } from "@/lib/email";

export const updateTeamAction = async (teamId: string, data: TTeamUpdateInput) => {
  return await updateTeam(teamId, data);
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

export const updateInviteAction = async (inviteId: string, teamId: string, data: TInviteUpdateInput) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const hasAccess = await hasTeamAccess({ id: session.user.id }, teamId);
  if (!hasAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const hasOwnerOrAdminAccess = await isAdminOrOwner({ id: session.user.id }, teamId);
  if (!hasOwnerOrAdminAccess) {
    throw new AuthenticationError("You are not allowed to update member's role in this team");
  }

  return await updateInvite(inviteId, data);
};

export const deleteInviteAction = async (inviteId: string, teamId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const hasAccess = await hasTeamAccess({ id: session.user.id }, teamId);
  if (!hasAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const hasOwnerOrAdminAccess = await isAdminOrOwner({ id: session.user.id }, teamId);
  if (!hasOwnerOrAdminAccess) {
    throw new AuthenticationError("You are not allowed to update member's role in this team");
  }

  return await deleteInvite(inviteId);
};

export const deleteMembershipAction = async (userId: string, teamId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const hasAccess = await hasTeamAccess({ id: session.user.id }, teamId);
  if (!hasAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const hasOwnerOrAdminAccess = await isAdminOrOwner({ id: session.user.id }, teamId);
  if (!hasOwnerOrAdminAccess) {
    throw new AuthenticationError("You are not allowed to update member's role in this team");
  }

  if (userId === session.user.id) {
    throw new AuthenticationError("You cannot delete yourself from the team");
  }

  return await deleteMembership(userId, teamId);
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
