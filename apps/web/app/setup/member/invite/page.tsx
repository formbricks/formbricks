import { InviteMembers } from "@/app/setup/member/invite/components/InviteMembers";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER } from "@formbricks/lib/constants";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";

export const metadata: Metadata = {
  title: "Invite",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = async () => {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/setup/signup");
  }

  const organizations = await getOrganizationsByUserId(session.user.id);
  if (organizations.length === 0) {
    redirect("/setup/organization/create");
  }

  if (session.user.onboardingCompleted) {
    redirect("/404");
  }

  const IS_SMTP_CONFIGURED: boolean = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD ? true : false;

  return <InviteMembers IS_SMTP_CONFIGURED={IS_SMTP_CONFIGURED} />;
};

export default Page;
