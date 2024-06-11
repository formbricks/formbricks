"use server";

import { getServerSession } from "next-auth";
import { sendInviteMemberEmail } from "@formbricks/email";
import { authOptions } from "@formbricks/lib/authOptions";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { inviteUser } from "@formbricks/lib/invite/service";
import { verifyUserRoleAccess } from "@formbricks/lib/organization/auth";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { AuthenticationError } from "@formbricks/types/errors";

export const inviteOrganizationMemberAction = async (email: string, organizationId: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }
  const organizations = await getOrganizationsByUserId(session.user.id);

  if (INVITE_DISABLED) {
    throw new AuthenticationError("Invite disabled");
  }

  const { hasCreateOrUpdateMembersAccess } = await verifyUserRoleAccess(organizationId, session.user.id);
  if (!hasCreateOrUpdateMembersAccess) {
    throw new AuthenticationError("Not authorized");
  }

  const invite = await inviteUser({
    organizationId: organizations[0].id,
    invitee: {
      email,
      name: "",
      role: "admin",
    },
  });

  if (invite) {
    await sendInviteMemberEmail(
      invite.id,
      email,
      session.user.name ?? "",
      "",
      false // is onboarding invite
    );
  }

  return invite;
};
