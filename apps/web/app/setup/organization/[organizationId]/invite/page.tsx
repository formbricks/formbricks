import { InviteMembers } from "@/app/setup/organization/[organizationId]/invite/components/invite-members";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER } from "@formbricks/lib/constants";
import { verifyUserRoleAccess } from "@formbricks/lib/organization/auth";
import { AuthenticationError } from "@formbricks/types/errors";

type Params = Promise<{
  organizationId: string;
}>;
export const metadata: Metadata = {
  title: "Invite",
  description: "Open-source Experience Management. Free & open source.",
};

interface InvitePageProps {
  params: Params;
}

const Page = async (props: InvitePageProps) => {
  const params = await props.params;
  const t = await getTranslations();
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

export default Page;
