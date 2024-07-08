"use server";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { sendInviteMemberEmail } from "@formbricks/email";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { hasOrganizationAuthority } from "@formbricks/lib/auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { deleteInvite, getInvite, inviteUser, resendInvite } from "@formbricks/lib/invite/service";
import { createInviteToken } from "@formbricks/lib/jwt";
import {
  deleteMembership,
  getMembershipByUserIdOrganizationId,
  getMembershipsByUserId,
} from "@formbricks/lib/membership/service";
import { verifyUserRoleAccess } from "@formbricks/lib/organization/auth";
import { deleteOrganization, updateOrganization } from "@formbricks/lib/organization/service";
import {
  AuthenticationError,
  AuthorizationError,
  OperationNotAllowedError,
  ValidationError,
} from "@formbricks/types/errors";
import { TMembershipRole } from "@formbricks/types/memberships";
import { ZOrganizationUpdateInput } from "@formbricks/types/organizations";

const ZUpdateOrganizationNameAction = z.object({
  organizationId: z.string(),
  data: ZOrganizationUpdateInput.pick({ name: true }),
});

export const updateOrganizationNameAction = authenticatedActionClient
  .schema(ZUpdateOrganizationNameAction)
  .action(async ({ parsedInput, ctx }) => {
    const organizationId = parsedInput.organizationId;
    await checkAuthorization({
      schema: ZOrganizationUpdateInput.pick({ name: true }),
      data: parsedInput.data,
      userId: ctx.user.id,
      organizationId: organizationId,
      rules: ["organization", "update"],
    });
    return await updateOrganization(parsedInput.organizationId, parsedInput.data);
  });

export const deleteInviteAction = async (inviteId: string, organizationId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasOrganizationAuthority(session.user.id, organizationId);

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  return await deleteInvite(inviteId);
};

export const deleteMembershipAction = async (userId: string, organizationId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasOrganizationAuthority(session.user.id, organizationId);

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  const { hasDeleteMembersAccess } = await verifyUserRoleAccess(organizationId, session.user.id);
  if (!hasDeleteMembersAccess) {
    throw new AuthenticationError("Not authorized");
  }

  if (userId === session.user.id) {
    throw new AuthenticationError("You cannot delete yourself from the organization");
  }

  return await deleteMembership(userId, organizationId);
};

export const leaveOrganizationAction = async (organizationId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organizationId);

  if (!membership) {
    throw new AuthenticationError("Not a member of this organization");
  }

  if (membership.role === "owner") {
    throw new ValidationError("You cannot leave a organization you own");
  }

  const memberships = await getMembershipsByUserId(session.user.id);
  if (!memberships || memberships?.length <= 1) {
    throw new ValidationError("You cannot leave the only organization you are a member of");
  }

  await deleteMembership(session.user.id, organizationId);
};

export const createInviteTokenAction = async (inviteId: string) => {
  const invite = await getInvite(inviteId);
  if (!invite) {
    throw new ValidationError("Invite not found");
  }
  const inviteToken = createInviteToken(inviteId, invite.email, {
    expiresIn: "7d",
  });

  return { inviteToken: encodeURIComponent(inviteToken) };
};

export const resendInviteAction = async (inviteId: string, organizationId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasOrganizationAuthority(session.user.id, organizationId);

  if (INVITE_DISABLED) {
    throw new AuthenticationError("Invite disabled");
  }

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  const { hasCreateOrUpdateMembersAccess } = await verifyUserRoleAccess(organizationId, session.user.id);
  if (!hasCreateOrUpdateMembersAccess) {
    throw new AuthenticationError("Not authorized");
  }
  const invite = await getInvite(inviteId);

  const updatedInvite = await resendInvite(inviteId);
  await sendInviteMemberEmail(
    inviteId,
    updatedInvite.email,
    invite?.creator.name ?? "",
    updatedInvite.name ?? ""
  );
};

export const inviteUserAction = async (
  organizationId: string,
  email: string,
  name: string,
  role: TMembershipRole
) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const isUserAuthorized = await hasOrganizationAuthority(session.user.id, organizationId);

  if (INVITE_DISABLED) {
    throw new AuthenticationError("Invite disabled");
  }

  if (!isUserAuthorized) {
    throw new AuthenticationError("Not authorized");
  }

  const { hasCreateOrUpdateMembersAccess } = await verifyUserRoleAccess(organizationId, session.user.id);
  if (!hasCreateOrUpdateMembersAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const invite = await inviteUser({
    organizationId,
    invitee: {
      email,
      name,
      role,
    },
  });

  if (invite) {
    await sendInviteMemberEmail(invite.id, email, session.user.name ?? "", name ?? "", false);
  }

  return invite;
};

export const deleteOrganizationAction = async (organizationId: string) => {
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  if (!isMultiOrgEnabled) throw new OperationNotAllowedError("Organization deletion disabled");
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  const { hasDeleteAccess } = await verifyUserRoleAccess(organizationId, session.user.id);

  if (!hasDeleteAccess) {
    throw new AuthorizationError("Not authorized");
  }

  return await deleteOrganization(organizationId);
};
