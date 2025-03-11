import { deleteInvite, getInvite } from "@/modules/auth/invite/lib/invite";
import { createTeamMembership } from "@/modules/auth/invite/lib/team";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { sendInviteAcceptedEmail } from "@/modules/email";
import { Button } from "@/modules/ui/components/button";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { after } from "next/server";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { getUser, updateUser } from "@formbricks/lib/user/service";
import { logger } from "@formbricks/logger";
import { ContentLayout } from "./components/content-layout";

interface InvitePageProps {
  searchParams: Promise<{ token: string }>;
}

export const InvitePage = async (props: InvitePageProps) => {
  const searchParams = await props.searchParams;
  const t = await getTranslate();
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

    if (isInviteExpired) {
      return (
        <ContentLayout
          headline={t("auth.invite.invite_expired")}
          description={t("auth.invite.invite_expired_description")}
        />
      );
    }

    if (!session) {
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
    }

    if (user?.email?.toLowerCase() !== email?.toLowerCase()) {
      return (
        <ContentLayout
          headline={t("auth.invite.email_does_not_match")}
          description={t("auth.invite.email_does_not_match_description")}>
          <Button asChild>
            <Link href="/">{t("auth.invite.go_to_app")}</Link>
          </Button>
        </ContentLayout>
      );
    }

    const createMembershipAction = async () => {
      "use server";

      if (!session || !user) return;

      await createMembership(invite.organizationId, session.user.id, {
        accepted: true,
        role: invite.role,
      });
      if (invite.teamIds) {
        await createTeamMembership(
          {
            organizationId: invite.organizationId,
            role: invite.role,
            teamIds: invite.teamIds,
          },
          user.id
        );
      }
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
    };

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
  } catch (e) {
    logger.warn(e);
    return (
      <ContentLayout
        headline={t("auth.invite.invite_not_found")}
        description={t("auth.invite.invite_not_found_description")}
      />
    );
  }
};
