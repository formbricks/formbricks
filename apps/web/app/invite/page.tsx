import Button from "@/components/ui/Button";
import { verifyInviteToken } from "@/lib/jwt";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";

export default async function JoinTeam({ searchParams }) {
    const currentUser = await getServerSession(authOptions);
    console.log("user", currentUser);

    const { inviteId, email } = await verifyInviteToken(searchParams.token);

    const invite = await prisma?.invite.findUnique({
        where: { id: inviteId },
    });

    const getContent = () => {
        if (!currentUser) {
            return <NotLoggedInContent />;
        } else if (currentUser.user.email !== email) {
            return <WrongAccountContent />;
        } else if (!invite) {
            return <ExpiredContent />;
        } else if (invite.accepted) {
            return <UsedContent />;
        } else {
            return <RightAccountContent />;
        }
    };

    return (
        <div>
            <p>ID: {inviteId}</p>
            <p>EMAIL: {email}</p>
            {getContent()}
        </div>
    );
}


const NotLoggedInContent = () => {
    return (
        <ContentLayout
            headline="Happy to have you 🫶"
            description="Please create an account or login."
        >
            <Button variant="secondary">Create account</Button>
            <Button variant="primary">Login</Button>
        </ContentLayout>
    );
};
const WrongAccountContent = () => {
    return (
        <ContentLayout
            headline="Ooops! Wrong email 🤦"
            description="The email in the invitation does not match yours."
        >
            <Button variant="secondary">Contact support</Button>
            <Button variant="primary">Go to app</Button>
        </ContentLayout>
    );
};
const RightAccountContent = () => {
    return (
        <ContentLayout
            headline="You’re in 🎉"
            description="Welcome to the team."
        >
            <Button variant="primary">Go to app</Button>
        </ContentLayout>
    );
};
const ExpiredContent = () => {
    return (
        <ContentLayout
            headline="Invite expired 😥"
            description="The invitation was valid for 7 days. Please request a new invite."
        >
        </ContentLayout>
    );
};
const UsedContent = () => {
    return (
        <ContentLayout
            headline="You’re already part of the squad."
            description="This invitation has already been used."
        >
            <Button variant="secondary">Contact support</Button>
            <Button variant="primary">Go to app</Button>
        </ContentLayout>
    );
};

const ContentLayout = ({ headline, description, children }) => {
    return (
        <div>
            <h2>{headline}</h2>
            <h2>{description}</h2>
            {children}
        </div>
    );
};