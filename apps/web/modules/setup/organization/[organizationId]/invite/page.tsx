import { SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER } from "@/lib/constants";
import { verifyUserRoleAccess } from "@/lib/organization/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { InviteMembers } from "@/modules/setup/organization/[organizationId]/invite/components/invite-members";
import { getTranslate } from "@/tolgee/server";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { AuthenticationError } from "@formbricks/types/errors";

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
  const IS_SMTP_CONFIGURED = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD);
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError(t("common.session_not_found"));

  const { hasCreateOrUpdateMembersAccess } = await verifyUserRoleAccess(
    params.organizationId,
    session.user.id
  );

  if (!hasCreateOrUpdateMembersAccess) return notFound();

  return <InviteMembers IS_SMTP_CONFIGURED={IS_SMTP_CONFIGURED} organizationId={params.organizationId} />;
};
