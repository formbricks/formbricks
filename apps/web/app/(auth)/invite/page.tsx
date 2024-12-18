import { authOptions } from "@/modules/auth/lib/authOptions";
import { sendInviteAcceptedEmail } from "@/modules/email";
import { createTeamMembership } from "@/modules/invite/lib/team";
import { Button } from "@/modules/ui/components/button";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { after } from "next/server";
import { DEFAULT_LOCALE, WEBAPP_URL } from "@formbricks/lib/constants";
import { deleteInvite, getInvite } from "@formbricks/lib/invite/service";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { getUser, updateUser } from "@formbricks/lib/user/service";
import { ContentLayout } from "./components/ContentLayout";

const Page = async (props) => {
  const searchParams = await props.searchParams;
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  const user = session?.user.id ? await getUser(session.user.id) : null;

  try {
    const { inviteId, email } = verifyInviteToken(searchParams.token);

    const invite = await getInvite(inviteId);

    if (!invite) {
      return (
        <ContentLayout
          headline={t("auth.invite.invite_not_found")}
          description={t("auth.invite.invite_not_found_description")}
        />
      );
    }

    const isInviteExpired = new Date(invite.expiresAt) < new Date();

    const createMembershipAction = async () => {
      "use server";

      if (!session || !user) return;

      await createMembership(invite.organizationId, session.user.id, {
        accepted: true,
        role: invite.role,
      });
      if (invite.teamIds) {
        await createTeamMembership(invite, user.id);
      }
      await deleteInvite(inviteId);
      await sendInviteAcceptedEmail(
        invite.creator.name ?? "",
        user?.name ?? "",
        invite.creator.email,
        user?.locale ?? DEFAULT_LOCALE
      );
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
    };

    if (isInviteExpired) {
      return (
        <ContentLayout
          headline={t("auth.invite.invite_expired")}
          description={t("auth.invite.invite_expired_description")}
        />
      );
    } else if (!session) {
      const redirectUrl = WEBAPP_URL + "/invite?token=" + searchParams.token;
      const encodedEmail = encodeURIComponent(email);
      return (
        <ContentLayout
          headline={t("auth.invite.happy_to_have_you")}
          description={t("auth.invite.happy_to_have_you_description")}>
          <Button variant="secondary" asChild>
            <Link href={`/auth/signup?inviteToken=${searchParams.token}&email=${encodedEmail}`}>
              {t("auth.invite.create_account")}
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/auth/login?callbackUrl=${redirectUrl}&email=${encodedEmail}`}>
              {t("auth.invite.login")}
            </Link>
          </Button>
        </ContentLayout>
      );
    } else if (user?.email?.toLowerCase() !== email?.toLowerCase()) {
      return (
        <ContentLayout
          headline={t("auth.invite.email_does_not_match")}
          description={t("auth.invite.email_does_not_match_description")}>
          <Button asChild>
            <Link href="/">{t("auth.invite.go_to_app")}</Link>
          </Button>
        </ContentLayout>
      );
    } else {
      after(async () => {
        await createMembershipAction();
      });
      return (
        <ContentLayout
          headline={t("auth.invite.welcome_to_organization")}
          description={t("auth.invite.welcome_to_organization_description")}>
          <Button asChild>
            <Link href="/">{t("auth.invite.go_to_app")}</Link>
          </Button>
        </ContentLayout>
      );
    }
  } catch (e) {
    console.error(e);
    return (
      <ContentLayout
        headline={t("auth.invite.invite_not_found")}
        description={t("auth.invite.invite_not_found_description")}
      />
    );
  }
};

export default Page;
