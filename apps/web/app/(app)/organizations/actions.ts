"use server";

import { getServerSession } from "next-auth";
import { sendInviteMemberEmail } from "@formbricks/email";
import { hasOrganizationAuthority } from "@formbricks/lib/auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { inviteUser } from "@formbricks/lib/invite/service";
import { verifyUserRoleAccess } from "@formbricks/lib/organization/auth";
import { updateProduct } from "@formbricks/lib/product/service";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProductConfig } from "@formbricks/types/product";

export const inviteOrganizationMemberAction = async (
  organizationId: string,
  email: string,
  role: TMembershipRole,
  inviteMessage: string
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
      name: "",
      role,
    },
  });

  if (invite) {
    await sendInviteMemberEmail(
      invite.id,
      email,
      session.user.name ?? "",
      "",
      true, // is onboarding invite
      inviteMessage
    );
  }

  return invite;
};

export const finishProductOnboardingAction = async (productId: string, productConfig: TProductConfig) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  await updateProduct(productId, { config: { ...productConfig, ...{ isOnboardingCompleted: true } } });
};
