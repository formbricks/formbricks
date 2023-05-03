import { sendInviteAcceptedEmail } from "@/lib/email";
import { verifyInviteToken } from "@/lib/jwt";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { env } from "process";
import { prisma } from "@formbricks/database";
import {
  NotLoggedInContent,
  WrongAccountContent,
  ExpiredContent,
  UsedContent,
  RightAccountContent,
} from "./InviteContentComponents";

export default async function JoinTeam({ searchParams }) {
  const currentUser = await getServerSession(authOptions);

  try {
    const { inviteId, email } = await verifyInviteToken(searchParams.token);

    const invite = await prisma?.invite.findUnique({
      where: { id: inviteId },
      include: { creator: true },
    });

    if (!currentUser) {
      const redirectUrl = env.NEXTAUTH_URL + "/invite?token=" + searchParams.token;
      return <NotLoggedInContent email={email} token={searchParams.token} redirectUrl={redirectUrl} />;
    } else if (currentUser.user?.email !== email) {
      return <WrongAccountContent />;
    } else if (!invite) {
      return <ExpiredContent />;
    } else if (invite.accepted) {
      return <UsedContent />;
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
