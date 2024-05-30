import { InviteMembers } from "@/app/setup/invite-members/components/InviteMembers";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";

export const metadata: Metadata = {
  title: "Login",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = async () => {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/setup/auth");
  }

  const organizations = await getOrganizationsByUserId(session.user.id);
  if (organizations.length === 0) {
    redirect("/setup/create-first-organization");
  }
  return <InviteMembers />;
};

export default Page;
