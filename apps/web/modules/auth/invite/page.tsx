/* eslint-disable react-hooks/error-boundaries -- InvitePage is an async Server Component, where
   try/catch genuinely is the boundary: the awaits that can throw run inside the try, on the server,
   during this function. The rule's premise (a throw comes from a *child's* render, after this
   function has returned its element tree, so only an error boundary can catch it) holds for client
   components and does not apply here. Scoped to the file because ESLint cannot tell a server
   component from a client one (ENG-2366). */
import Link from "next/link";
import { after } from "next/server";
import { Toaster } from "react-hot-toast";
import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { getUser, updateUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { AuthCard, AuthFooter } from "@/modules/auth/components/auth-card";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { AuthLink } from "@/modules/auth/components/auth-link";
import { AuthPage } from "@/modules/auth/components/form-wrapper";
import { deleteInvite, getInvite } from "@/modules/auth/invite/lib/invite";
import { createTeamMembership } from "@/modules/auth/invite/lib/team";
import { getSession } from "@/modules/auth/lib/session";
import { SignupFormLoader } from "@/modules/auth/signup/components/signup-form-loader";
import { sendInviteAcceptedEmail } from "@/modules/email";
import { Button } from "@/modules/ui/components/button";
import { ContentLayout } from "./components/content-layout";
import { InviteSummary } from "./components/invite-summary";

interface InvitePageProps {
  searchParams: Promise<{ token: string }>;
}

type TranslateFn = Awaited<ReturnType<typeof getTranslate>>;

// Written out per role because `scan-translations` only recognizes literal keys.
const getRoleLabel = (t: TranslateFn, role: string): string => {
  switch (role) {
    case "owner":
      return t("shell.auth.invite.role_owner");
    case "manager":
      return t("shell.auth.invite.role_manager");
    case "billing":
      return t("shell.auth.invite.role_billing");
    default:
      return t("shell.auth.invite.role_member");
  }
};

export const InvitePage = async (props: InvitePageProps) => {
  const searchParams = await props.searchParams;
  const t = await getTranslate();
  const session = await getSession();
  const user = session?.user.id ? await getUser(session.user.id) : null;

  try {
    const { inviteId, email } = verifyInviteToken(searchParams.token);

    const invite = await getInvite(inviteId);

    if (!invite) {
      return (
        <ContentLayout
          headline={t("shell.auth.invite.not_found_title")}
          description={t("auth.invite.invite_not_found_description")}
        />
      );
    }

    const isInviteExpired = new Date(invite.expiresAt) < new Date();

    if (isInviteExpired) {
      return (
        <ContentLayout
          headline={t("shell.auth.invite.expired_title")}
          description={t("auth.invite.invite_expired_description")}
        />
      );
    }

    if (!session) {
      const redirectUrl = WEBAPP_URL + "/invite?token=" + searchParams.token;
      const encodedEmail = encodeURIComponent(email);
      const inviterName = invite.creator.name?.trim();
      const roleLabel = getRoleLabel(t, invite.role);
      return (
        <>
          <Toaster />
          <AuthPage>
            <AuthCard>
              <AuthHeading
                title={t("shell.auth.invite.join_title", { organization: invite.organization.name })}
                description={
                  inviterName
                    ? t("shell.auth.invite.join_description", { inviter: inviterName, role: roleLabel })
                    : t("shell.auth.invite.join_description_no_inviter", { role: roleLabel })
                }
              />
              <InviteSummary
                organizationName={invite.organization.name}
                roleLabel={t("shell.auth.invite.role", { role: roleLabel })}
              />
              <SignupFormLoader inviteToken={searchParams.token} emailFromSearchParams={email} emailLocked />
            </AuthCard>
            <AuthFooter>
              {t("shell.auth.signup.have_account")}{" "}
              <AuthLink href={`/auth/login?callbackUrl=${redirectUrl}&email=${encodedEmail}`}>
                {t("shell.auth.invite.log_in_to_accept")}
              </AuthLink>
            </AuthFooter>
          </AuthPage>
        </>
      );
    }

    if (user?.email?.toLowerCase() !== email?.toLowerCase()) {
      return (
        <ContentLayout
          headline={t("shell.auth.invite.email_mismatch_title")}
          description={t("auth.invite.email_does_not_match_description")}>
          <Button asChild className="h-11 w-full sm:h-9">
            <Link href="/">{t("shell.auth.invite.go_to_organization")}</Link>
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
      // Best-effort: the invite is already accepted, so a notice the SMTP server refuses must not stop the
      // rest of the acceptance.
      try {
        await sendInviteAcceptedEmail(
          invite.creator.name ?? "",
          user?.name ?? "",
          invite.creator.email,
          invite.creator.locale
        );
      } catch (error) {
        logger.error({ err: error }, "Failed to send invite accepted email");
      }
      await updateUser(session.user.id, {
        notificationSettings: {
          ...user.notificationSettings,
          alert: user.notificationSettings.alert ?? {},
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
        headline={t("shell.auth.invite.joined_title", { organization: invite.organization.name })}
        description={t("auth.invite.welcome_to_organization_description")}>
        <Button asChild className="h-11 w-full sm:h-9">
          {/* The membership is created in `after()` above, which has long finished by the time a
              person clicks, so the link can go straight to the organization they just joined. */}
          <Link href={`/organizations/${invite.organizationId}`}>
            {t("shell.auth.invite.go_to_organization")}
          </Link>
        </Button>
      </ContentLayout>
    );
  } catch (e) {
    logger.error(e, "Error in InvitePage");
    return (
      <ContentLayout
        headline={t("shell.auth.invite.not_found_title")}
        description={t("auth.invite.invite_not_found_description")}
      />
    );
  }
};
