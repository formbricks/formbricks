import { sendInviteAcceptedEmail } from "@/app/lib/email";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import {
  NotLoggedInContent,
  WrongAccountContent,
  ExpiredContent,
  UsedContent,
  RightAccountContent,
} from "./components/InviteContentComponents";
import { env } from "@formbricks/lib/env.mjs";
import { deleteInvite, getInvite } from "@formbricks/lib/invite/service";
import { createMembership } from "@formbricks/lib/membership/service";

export default async function JoinTeam({ searchParams }) {
  const currentUser = await getServerSession(authOptions);

  try {
    const { inviteId, email } = verifyInviteToken(searchParams.token);

    const invite = await getInvite(inviteId);

    const isInviteExpired = invite ? new Date(invite.expiresAt) < new Date() : true;

    if (!invite || isInviteExpired) {
      return <ExpiredContent />;
    } else if (invite.accepted) {
      return <UsedContent />;
    } else if (!currentUser) {
      const redirectUrl = env.NEXTAUTH_URL + "/invite?token=" + searchParams.token;
      return <NotLoggedInContent email={email} token={searchParams.token} redirectUrl={redirectUrl} />;
    } else if (currentUser.user?.email !== email) {
      return <WrongAccountContent />;
    } else {
      await createMembership(invite.teamId, currentUser.user.id, { accepted: true, role: invite.role });
      await deleteInvite(inviteId);

      sendInviteAcceptedEmail(invite.creator.name ?? "", currentUser.user?.name, invite.creator.email);

      return <RightAccountContent />;
    }
  } catch (e) {
    return <ExpiredContent />;
  }
}
