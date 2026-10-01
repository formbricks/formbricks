/* eslint-disable react-hooks/error-boundaries -- InvitePage is an async Server Component, where
   try/catch genuinely is the boundary: the awaits that can throw run inside the try, on the server,
   during this function. The rule's premise (a throw comes from a *child's* render, after this
   function has returned its element tree, so only an error boundary can catch it) holds for client
   components and does not apply here. Scoped to the file because ESLint cannot tell a server
   component from a client one (ENG-2366). */
import Link from "next/link";
import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";
import { ContentLayout } from "./components/content-layout";
import { acceptInvitation } from "./lib/accept-invitation";

interface InvitePageProps {
  searchParams: Promise<{ token: string }>;
}

export const InvitePage = async (props: Readonly<InvitePageProps>) => {
  const searchParams = await props.searchParams;
  const t = await getTranslate();
  try {
    const result = await acceptInvitation(searchParams.token);

    if (result.status === "not_found") {
      return (
        <ContentLayout
          headline={t("auth.invite.invite_not_found")}
          description={t("auth.invite.invite_not_found_description")}
        />
      );
    }

    if (result.status === "expired") {
      return (
        <ContentLayout
          headline={t("auth.invite.invite_expired")}
          description={t("auth.invite.invite_expired_description")}
        />
      );
    }

    if (result.status === "sign_in_required") {
      const redirectUrl = WEBAPP_URL + "/invite?token=" + searchParams.token;
      const encodedEmail = encodeURIComponent(result.email ?? "");
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

    if (result.status === "email_mismatch") {
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
    logger.error(e, "Error in InvitePage");
    return (
      <ContentLayout
        headline={t("auth.invite.invite_not_found")}
        description={t("auth.invite.invite_not_found_description")}
      />
    );
  }
};
