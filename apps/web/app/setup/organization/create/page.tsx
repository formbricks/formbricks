import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";

import { CreateFirstOrganization } from "./components/CreateFirstOrganiztion";

export const metadata: Metadata = {
  title: "Create Organization",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = async () => {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/setup/signup");
  }

  return <CreateFirstOrganization />;
};

export default Page;
