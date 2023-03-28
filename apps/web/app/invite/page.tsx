import { verifyInviteToken } from "@/lib/jwt";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";
import { env } from "process";
import { NotLoggedInContent, WrongAccountContent, ExpiredContent, UsedContent, RightAccountContent } from "./InviteContentComponents";

export default async function JoinTeam({ searchParams }) {
    const currentUser = await getServerSession(authOptions);
    console.log("user", currentUser);


    try {
        const { inviteId, email } = await verifyInviteToken(searchParams.token);

        const invite = await prisma?.invite.findUnique({
            where: { id: inviteId },
        });

        if (!currentUser) {
            const redirectUrl = env.NEXTAUTH_URL + "/invite?token=" + searchParams.token;
            return <NotLoggedInContent
                email={email}
                token={searchParams.token}
                redirectUrl={redirectUrl}
            />;
        } else if (currentUser.user.email !== email) {
            return <WrongAccountContent />;
        } else if (!invite) {
            return <ExpiredContent />;
        } else if (invite.accepted) {
            return <UsedContent />;
        } else {
            return <RightAccountContent />;
        }
    } catch (e) {
        return <ExpiredContent />;
    }
}