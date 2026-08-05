import { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthenticationError } from "@formbricks/types/errors";
import { SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER } from "@/lib/constants";
import { verifyUserRoleAccess } from "@/lib/organization/auth";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { InviteMembers } from "@/modules/setup/organization/[organizationId]/invite/components/invite-members";

export const metadata: Metadata = {
  title: "Invite",
  description: "Open-source Experience Management. Free & open source.",
};

interface InvitePageProps {
  params: Promise<{ organizationId: string }>;
}

export const InvitePage = async (props: InvitePageProps) => {
  const params = await props.params;
  const t = await getTranslate();
  // Deliberately stricter than the `IS_SMTP_CONFIGURED` exported from lib/constants (host + port only),
  // despite the shared name: onboarding also wants credentials present before it stops warning. Do not
  // "de-duplicate" this against that constant — an authenticated relay with `SMTP_AUTHENTICATED=0` is a
  // valid setup, so importing it would silently drop the warning for a half-configured mailer.
  const IS_SMTP_CONFIGURED = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD);
  const session = await getSession();
  if (!session) throw new AuthenticationError(t("common.session_not_found"));

  const { hasCreateOrUpdateMembersAccess } = await verifyUserRoleAccess(
    params.organizationId,
    session.user.id
  );

  if (!hasCreateOrUpdateMembersAccess) return notFound();

  return <InviteMembers IS_SMTP_CONFIGURED={IS_SMTP_CONFIGURED} organizationId={params.organizationId} />;
};
