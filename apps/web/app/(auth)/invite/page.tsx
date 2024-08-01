import { getServerSession } from "next-auth";
import { sendInviteAcceptedEmail } from "@formbricks/email";
import { authOptions } from "@formbricks/lib/authOptions";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { deleteInvite, getInvite } from "@formbricks/lib/invite/service";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { getUser, updateUser } from "@formbricks/lib/user/service";
import { Button } from "@formbricks/ui/Button";
import { ContentLayout } from "./components/ContentLayout";

const Page = async ({ searchParams }) => {
  const session = await getServerSession(authOptions);
  const user = session?.user.id ? await getUser(session.user.id) : null;

  try {
    const { inviteId, email } = verifyInviteToken(searchParams.token);

    const invite = await getInvite(inviteId);

    if (!invite) {
      return (
        <ContentLayout
          headline="Invite not found 😥"
          description="The invitation code cannot be found or has already been used."
        />
      );
    }

    const isInviteExpired = new Date(invite.expiresAt) < new Date();

    if (isInviteExpired) {
      return (
        <ContentLayout
          headline="Invite expired 😥"
          description="Invites are valid for 7 days. Please request a new invite."
        />
      );
    } else if (invite.accepted) {
      return (
        <ContentLayout
          headline="You’re already part of the squad."
          description="This invitation has already been used.">
          <Button variant="secondary" href="/support">
            Contact support
          </Button>
          <Button href="/">Go to app</Button>
        </ContentLayout>
      );
    } else if (!session) {
      const redirectUrl = WEBAPP_URL + "/invite?token=" + searchParams.token;
      const encodedEmail = encodeURIComponent(email);
      return (
        <ContentLayout headline="Happy to have you 🤗" description="Please create an account or login.">
          <Button
            variant="secondary"
            href={`/auth/signup?inviteToken=${searchParams.token}&email=${encodedEmail}`}>
            Create account
          </Button>
          <Button href={`/auth/login?callbackUrl=${redirectUrl}&email=${encodedEmail}`}>Login</Button>
        </ContentLayout>
      );
    } else if (user?.email !== email) {
      return (
        <ContentLayout
          headline="Ooops! Wrong email 🤦"
          description="The email in the invitation does not match yours.">
          <Button variant="secondary" href="/support">
            Contact support
          </Button>
          <Button href="/">Go to app</Button>
        </ContentLayout>
      );
    } else {
      await createMembership(invite.organizationId, session.user.id, { accepted: true, role: invite.role });
      await deleteInvite(inviteId);

      await sendInviteAcceptedEmail(invite.creator.name ?? "", user?.name ?? "", invite.creator.email);
      await updateUser(session.user.id, {
        notificationSettings: {
          ...user.notificationSettings,
          alert: user.notificationSettings.alert ?? {},
          weeklySummary: user.notificationSettings.weeklySummary ?? {},
          unsubscribedOrganizationIds: Array.from(
            new Set([
              ...(user.notificationSettings?.unsubscribedOrganizationIds || []),
              invite.organizationId,
            ])
          ),
        },
      });
      return (
        <ContentLayout headline="You’re in 🎉" description="Welcome to the organization.">
          <Button href="/">Go to app</Button>
        </ContentLayout>
      );
    }
  } catch (e) {
    console.error(e);
    return (
      <ContentLayout
        headline="Invite not found 😥"
        description="The invitation code cannot be found or has already been used."
      />
    );
  }
};

export default Page;
