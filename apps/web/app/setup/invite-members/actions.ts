"use server";

import { getServerSession } from "next-auth";

import { sendInviteMemberEmail } from "@formbricks/email";
import { authOptions } from "@formbricks/lib/authOptions";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { inviteUser } from "@formbricks/lib/invite/service";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { AuthenticationError } from "@formbricks/types/errors";

export const inviteOrganizationMemberAction = async (email: string) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }
  const organizations = await getOrganizationsByUserId(session.user.id);

  if (INVITE_DISABLED) {
    throw new AuthenticationError("Invite disabled");
  }

  const invite = await inviteUser({
    organizationId: organizations[0].id,
    currentUser: { id: session.user.id, name: session.user.name },
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
      true // is onboarding invite
    );
  }

  return invite;
};
