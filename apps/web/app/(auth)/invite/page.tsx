import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { sendInviteAcceptedEmail } from "@formbricks/lib/emails/emails";
import { deleteInvite, getInvite } from "@formbricks/lib/invite/service";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { updateUser } from "@formbricks/lib/user/service";

import {
  ExpiredContent,
  InvitationNotFound,
  NotLoggedInContent,
  RightAccountContent,
  UsedContent,
  WrongAccountContent,
} from "./components/InviteContentComponents";

export default async function InvitePage({ searchParams }) {
  const session = await getServerSession(authOptions);

  try {
    const { inviteId, email } = verifyInviteToken(searchParams.token);

    const invite = await getInvite(inviteId);

    if (!invite) {
      return <InvitationNotFound />;
    }

    const isInviteExpired = new Date(invite.expiresAt) < new Date();

    if (isInviteExpired) {
      return <ExpiredContent />;
    } else if (invite.accepted) {
      return <UsedContent />;
    } else if (!session) {
      const redirectUrl = WEBAPP_URL + "/invite?token=" + searchParams.token;
      return <NotLoggedInContent email={email} token={searchParams.token} redirectUrl={redirectUrl} />;
    } else if (session.user?.email !== email) {
      return <WrongAccountContent />;
    } else {
      await createMembership(invite.teamId, session.user.id, { accepted: true, role: invite.role });
      await deleteInvite(inviteId);

      sendInviteAcceptedEmail(invite.creator.name ?? "", session.user?.name ?? "", invite.creator.email);
      updateUser(session.user.id, { onboardingCompleted: true });
      return <RightAccountContent />;
    }
  } catch (e) {
    console.error(e);
    return <InvitationNotFound />;
  }
}
