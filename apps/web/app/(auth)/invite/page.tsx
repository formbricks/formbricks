import { sendInviteAcceptedEmail } from "@/app/lib/email";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { prisma } from "@formbricks/database";
import {
  NotLoggedInContent,
  WrongAccountContent,
  ExpiredContent,
  UsedContent,
  RightAccountContent,
} from "./components/InviteContentComponents";
import { env } from "@formbricks/lib/env.mjs";

export default async function JoinTeam({ searchParams }) {
  const currentUser = await getServerSession(authOptions);

  try {
    const { inviteId, email } = await verifyInviteToken(searchParams.token);

    const invite = await prisma?.invite.findUnique({
      where: { id: inviteId },
      include: { creator: true },
    });

    const isExpired = (i) => new Date(i.expiresAt) < new Date();

    if (!invite || isExpired(invite)) {
      return <ExpiredContent />;
    } else if (invite.accepted) {
      return <UsedContent />;
    } else if (!currentUser) {
      const redirectUrl = env.NEXTAUTH_URL + "/invite?token=" + searchParams.token;
      return <NotLoggedInContent email={email} token={searchParams.token} redirectUrl={redirectUrl} />;
    } else if (currentUser.user?.email !== email) {
      return <WrongAccountContent />;
    } else {
      // create membership
      await prisma?.membership.create({
        data: {
          team: {
            connect: {
              id: invite.teamId,
            },
          },
          user: {
            connect: {
              id: currentUser.user?.id,
            },
          },
          role: invite.role,
          accepted: true,
        },
      });

      // delete invite
      await prisma?.invite.delete({
        where: {
          id: inviteId,
        },
      });

      sendInviteAcceptedEmail(invite.creator.name, currentUser.user?.name, invite.creator.email);

      return <RightAccountContent />;
    }
  } catch (e) {
    return <ExpiredContent />;
  }
}
