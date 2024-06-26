import { InviteMembers } from "@/app/setup/organization/[organizationId]/invite/components/InviteMembers";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER } from "@formbricks/lib/constants";
import { verifyUserRoleAccess } from "@formbricks/lib/organization/auth";
import { AuthenticationError } from "@formbricks/types/errors";

export const metadata: Metadata = {
  title: "Invite",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = async ({ params }) => {
  const IS_SMTP_CONFIGURED: boolean = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD ? true : false;
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthenticationError("Not Authenticated");

  const { hasCreateOrUpdateMembersAccess } = await verifyUserRoleAccess(
    params.organizationId,
    session.user.id
  );

  if (!hasCreateOrUpdateMembersAccess) return notFound();

  return <InviteMembers IS_SMTP_CONFIGURED={IS_SMTP_CONFIGURED} organizationId={params.organizationId} />;
};

export default Page;
